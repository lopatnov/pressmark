using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Turns a page of feed item entities into a <see cref="FeedPage"/> response by
/// batch-loading the per-viewer read/like/bookmark state for the whole page.
/// Keeping this out of the gRPC service keeps the endpoints to query composition.
/// </summary>
public class FeedPageAssembler(AppDbContext db, IDbContextFactory<AppDbContext> dbFactory)
{
    /// <summary>
    /// Assembles a page for a signed-in user (personal feed and bookmarks).
    /// </summary>
    /// <param name="allBookmarked">When true (bookmarks), all items are bookmarked by definition.</param>
    /// <param name="includeTotalUnread">When true (first page of the feed), compute and set TotalUnread.</param>
    public async Task<FeedPage> AssembleUserPageAsync(
        List<Entities.FeedItem> pageItems,
        bool hasMore,
        Guid userId,
        bool allBookmarked,
        bool includeTotalUnread,
        CancellationToken ct)
    {
        var ids = pageItems.Select(f => f.Id).ToList();

        // Parallel lookups — each query gets its own DbContext instance because EF Core
        // does not allow concurrent operations on the same context.
        await using var ctx1 = await dbFactory.CreateDbContextAsync(ct);
        await using var ctx2 = await dbFactory.CreateDbContextAsync(ct);
        // Bookmarks are the one lookup that can be answered without asking the database,
        // so its context is only opened when it is actually queried.
        await using var ctx3 = allBookmarked ? null : await dbFactory.CreateDbContextAsync(ct);
        await using var ctx4 = await dbFactory.CreateDbContextAsync(ct);

        var readIdsTask = ctx1.ReadItems
            .Where(r => r.UserId == userId && ids.Contains(r.FeedItemId))
            .Select(r => r.FeedItemId).ToHashSetAsync(ct);
        var likedIdsTask = ctx2.Likes
            .Where(l => l.UserId == userId && ids.Contains(l.FeedItemId))
            .Select(l => l.FeedItemId).ToHashSetAsync(ct);
        var bookmarkIdsTask = allBookmarked
            ? Task.FromResult(ids.ToHashSet())
            : ctx3!.Bookmarks
                .Where(b => b.UserId == userId && ids.Contains(b.FeedItemId))
                .Select(b => b.FeedItemId).ToHashSetAsync(ct);
        var likeCountsTask = ctx4.Likes
            .Where(l => ids.Contains(l.FeedItemId))
            .GroupBy(l => l.FeedItemId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        await Task.WhenAll(readIdsTask, likedIdsTask, bookmarkIdsTask, likeCountsTask);

        var readIds = readIdsTask.Result;
        var likedIds = likedIdsTask.Result;
        var bookmarkIds = bookmarkIdsTask.Result;
        var likeCounts = likeCountsTask.Result;

        var page = new FeedPage();

        if (includeTotalUnread)
        {
            var readFeedItemIds = db.ReadItems
                .Where(r => r.UserId == userId)
                .Select(r => r.FeedItemId);
            page.TotalUnread = await db.FeedItems
                .CountAsync(f => f.Subscription.UserId == userId && !readFeedItemIds.Contains(f.Id), ct);
        }

        foreach (var item in pageItems)
            page.Items.Add(FeedItemMapper.ToProto(item, readIds, likedIds, bookmarkIds, likeCounts));

        page.NextCursor = FeedQueryExtensions.NextCursor(pageItems, hasMore);
        return page;
    }

    /// <summary>
    /// Assembles a page of the public community feed. The viewer is optional: anonymous
    /// callers get like counts only, signed-in callers also get their own like/bookmark state.
    /// Read state is never part of the community feed.
    /// </summary>
    public async Task<FeedPage> AssembleCommunityPageAsync(
        List<Entities.FeedItem> pageItems,
        bool hasMore,
        Guid? viewerId,
        CancellationToken ct)
    {
        var ids = pageItems.Select(f => f.Id).ToList();

        var likeCounts = await db.Likes
            .Where(l => ids.Contains(l.FeedItemId))
            .GroupBy(l => l.FeedItemId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        HashSet<Guid> likedIds = [];
        HashSet<Guid> bookmarkIds = [];

        if (viewerId.HasValue)
        {
            likedIds = await db.Likes
                .Where(l => l.UserId == viewerId && ids.Contains(l.FeedItemId))
                .Select(l => l.FeedItemId).ToHashSetAsync(ct);
            bookmarkIds = await db.Bookmarks
                .Where(b => b.UserId == viewerId && ids.Contains(b.FeedItemId))
                .Select(b => b.FeedItemId).ToHashSetAsync(ct);
        }

        var page = new FeedPage();
        foreach (var item in pageItems)
            page.Items.Add(FeedItemMapper.ToProto(item, [], likedIds, bookmarkIds, likeCounts));

        page.NextCursor = FeedQueryExtensions.NextCursor(pageItems, hasMore);
        return page;
    }
}
