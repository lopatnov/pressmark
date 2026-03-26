using System.Security.Claims;
using System.Text;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

[Authorize]
public class FeedServiceImpl(AppDbContext db, FeedUpdateBroadcaster broadcaster) : FeedService.FeedServiceBase
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize     = 100;

    public override async Task<FeedPage> GetFeed(
        GetFeedRequest request, ServerCallContext context)
    {
        var userId   = GetUserId(context);
        var ct       = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var query = db.FeedItems
            .Include(f => f.Subscription)
            .Where(f => f.Subscription.UserId == userId
                     && !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned);

        if (!string.IsNullOrEmpty(request.SubscriptionId)
            && Guid.TryParse(request.SubscriptionId, out var subId))
            query = query.Where(f => f.SubscriptionId == subId);

        if (request.UnreadOnly)
            query = query.Where(f =>
                !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id));

        // Decode cursor: "publishedAt_ticks|id"
        if (!string.IsNullOrEmpty(request.Cursor) && TryParseCursor(request.Cursor,
                out var cursorDate, out var cursorId))
        {
            query = query.Where(f =>
                f.PublishedAt < cursorDate ||
                (f.PublishedAt == cursorDate && f.Id.CompareTo(cursorId) < 0));
        }

        var items = await query
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore  = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();

        // Enrich with read/like/bookmark state
        var ids       = pageItems.Select(f => f.Id).ToList();
        var readIds   = await db.ReadItems
            .Where(r => r.UserId == userId && ids.Contains(r.FeedItemId))
            .Select(r => r.FeedItemId).ToHashSetAsync(ct);
        var likedIds  = await db.Likes
            .Where(l => l.UserId == userId && ids.Contains(l.FeedItemId))
            .Select(l => l.FeedItemId).ToHashSetAsync(ct);
        var bookmarkIds = await db.Bookmarks
            .Where(b => b.UserId == userId && ids.Contains(b.FeedItemId))
            .Select(b => b.FeedItemId).ToHashSetAsync(ct);
        var likeCounts = await db.Likes
            .Where(l => ids.Contains(l.FeedItemId))
            .GroupBy(l => l.FeedItemId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var readFeedItemIds = db.ReadItems
            .Where(r => r.UserId == userId)
            .Select(r => r.FeedItemId);
        var totalUnread = await db.FeedItems
            .CountAsync(f => f.Subscription.UserId == userId && !readFeedItemIds.Contains(f.Id), ct);

        var page = new FeedPage { TotalUnread = totalUnread };

        foreach (var item in pageItems)
            page.Items.Add(ToProto(item, readIds, likedIds, bookmarkIds, likeCounts));

        if (hasMore)
        {
            var last = pageItems.Last();
            page.NextCursor = EncodeCursor(last.PublishedAt, last.Id);
        }

        return page;
    }

    public override async Task<Empty> MarkAsRead(
        MarkAsReadRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var itemId = Guid.Parse(request.FeedItemId);
        var ct     = context.CancellationToken;

        var exists = await db.ReadItems
            .AnyAsync(r => r.UserId == userId && r.FeedItemId == itemId, ct);

        if (!exists)
        {
            db.ReadItems.Add(new ReadItem { UserId = userId, FeedItemId = itemId });
            await db.SaveChangesAsync(ct);
        }

        return new Empty();
    }

    public override async Task<Empty> MarkAllAsRead(
        MarkAllAsReadRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct     = context.CancellationToken;

        var query = db.FeedItems
            .Include(f => f.Subscription)
            .Where(f => f.Subscription.UserId == userId
                     && !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id));

        if (!string.IsNullOrEmpty(request.SubscriptionId)
            && Guid.TryParse(request.SubscriptionId, out var subId))
            query = query.Where(f => f.SubscriptionId == subId);

        var unreadIds = await query.Select(f => f.Id).ToListAsync(ct);

        db.ReadItems.AddRange(unreadIds.Select(id =>
            new ReadItem { UserId = userId, FeedItemId = id }));

        await db.SaveChangesAsync(ct);
        return new Empty();
    }

    public override async Task<UnreadCount> GetUnreadCount(
        Empty request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct     = context.CancellationToken;

        var count = await db.FeedItems
            .CountAsync(f => f.Subscription.UserId == userId
                          && !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id),
                        ct);

        return new UnreadCount { Count = count };
    }

    public override async Task<ToggleLikeResponse> ToggleLike(
        ToggleLikeRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var itemId = Guid.Parse(request.FeedItemId);
        var ct     = context.CancellationToken;

        var like = await db.Likes
            .FirstOrDefaultAsync(l => l.UserId == userId && l.FeedItemId == itemId, ct);

        if (like is not null)
            db.Likes.Remove(like);
        else
            db.Likes.Add(new Like { UserId = userId, FeedItemId = itemId });

        await db.SaveChangesAsync(ct);

        var count   = await db.Likes.CountAsync(l => l.FeedItemId == itemId, ct);
        var isLiked = like is null; // if we removed it, now not liked; if we added, now liked

        return new ToggleLikeResponse { IsLiked = isLiked, LikeCount = count };
    }

    public override async Task<ToggleBookmarkResponse> ToggleBookmark(
        ToggleBookmarkRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var itemId = Guid.Parse(request.FeedItemId);
        var ct     = context.CancellationToken;

        var bookmark = await db.Bookmarks
            .FirstOrDefaultAsync(b => b.UserId == userId && b.FeedItemId == itemId, ct);

        if (bookmark is not null)
            db.Bookmarks.Remove(bookmark);
        else
            db.Bookmarks.Add(new Bookmark { UserId = userId, FeedItemId = itemId });

        await db.SaveChangesAsync(ct);

        return new ToggleBookmarkResponse { IsBookmarked = bookmark is null };
    }

    public override async Task<FeedPage> GetBookmarks(
        GetBookmarksRequest request, ServerCallContext context)
    {
        var userId   = GetUserId(context);
        var ct       = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var query = db.FeedItems
            .Include(f => f.Subscription)
            .Where(f => db.Bookmarks.Any(b => b.UserId == userId && b.FeedItemId == f.Id));

        if (!string.IsNullOrEmpty(request.Cursor) && TryParseCursor(request.Cursor,
                out var cursorDate, out var cursorId))
        {
            query = query.Where(f =>
                f.PublishedAt < cursorDate ||
                (f.PublishedAt == cursorDate && f.Id.CompareTo(cursorId) < 0));
        }

        var items = await query
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore   = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();

        var ids      = pageItems.Select(f => f.Id).ToList();
        var readIds  = await db.ReadItems
            .Where(r => r.UserId == userId && ids.Contains(r.FeedItemId))
            .Select(r => r.FeedItemId).ToHashSetAsync(ct);
        var likedIds = await db.Likes
            .Where(l => l.UserId == userId && ids.Contains(l.FeedItemId))
            .Select(l => l.FeedItemId).ToHashSetAsync(ct);
        var likeCounts = await db.Likes
            .Where(l => ids.Contains(l.FeedItemId))
            .GroupBy(l => l.FeedItemId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        var page = new FeedPage();
        foreach (var item in pageItems)
            page.Items.Add(ToProto(item, readIds, likedIds,
                ids.ToHashSet(), likeCounts)); // bookmarked = all (they are bookmarks)

        if (hasMore)
        {
            var last = pageItems.Last();
            page.NextCursor = EncodeCursor(last.PublishedAt, last.Id);
        }

        return page;
    }

    [AllowAnonymous]
    public override async Task<FeedPage> GetCommunityFeed(
        GetCommunityFeedRequest request, ServerCallContext context)
    {
        var ct       = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var windowDaysStr = await db.SiteSettings
            .Where(s => s.Key == "community_window_days")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct) ?? "1";

        var windowDays = int.TryParse(windowDaysStr, out var d) ? d : 1;
        var since = DateTime.UtcNow.AddDays(-windowDays);

        var query = db.FeedItems
            .Include(f => f.Subscription)
            .Where(f => !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned
                     && db.Likes.Any(l => l.FeedItemId == f.Id && l.CreatedAt >= since));

        if (!string.IsNullOrEmpty(request.Cursor) && TryParseCursor(request.Cursor,
                out var cursorDate, out var cursorId))
        {
            query = query.Where(f =>
                f.PublishedAt < cursorDate ||
                (f.PublishedAt == cursorDate && f.Id.CompareTo(cursorId) < 0));
        }

        var items = await query
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore   = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();

        var ids = pageItems.Select(f => f.Id).ToList();
        var likeCounts = await db.Likes
            .Where(l => ids.Contains(l.FeedItemId))
            .GroupBy(l => l.FeedItemId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        // Determine current user for is_liked / is_bookmarked (optional, anonymous = false)
        Guid? userId = null;
        var claim = context.GetHttpContext().User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claim != null) userId = Guid.Parse(claim);

        HashSet<Guid> likedIds    = [];
        HashSet<Guid> bookmarkIds = [];

        if (userId.HasValue)
        {
            likedIds = await db.Likes
                .Where(l => l.UserId == userId && ids.Contains(l.FeedItemId))
                .Select(l => l.FeedItemId).ToHashSetAsync(ct);
            bookmarkIds = await db.Bookmarks
                .Where(b => b.UserId == userId && ids.Contains(b.FeedItemId))
                .Select(b => b.FeedItemId).ToHashSetAsync(ct);
        }

        var page = new FeedPage();
        foreach (var item in pageItems)
            page.Items.Add(ToProto(item, [], likedIds, bookmarkIds, likeCounts));

        if (hasMore)
        {
            var last = pageItems.Last();
            page.NextCursor = EncodeCursor(last.PublishedAt, last.Id);
        }

        return page;
    }

    public override async Task StreamFeedUpdates(
        StreamFeedRequest request,
        IServerStreamWriter<Protos.FeedItem> responseStream,
        ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct     = context.CancellationToken;

        // Load the user's active subscription IDs for filtering broadcast events
        var userSubIds = await db.Subscriptions
            .Where(s => s.UserId == userId && !s.IsCommunityBanned)
            .Select(s => s.Id)
            .ToHashSetAsync(ct);

        // Catch-up: send items published after since_timestamp that the client may have missed
        if (!string.IsNullOrEmpty(request.SinceTimestamp)
            && DateTime.TryParse(request.SinceTimestamp, null,
                System.Globalization.DateTimeStyles.RoundtripKind, out var since))
        {
            var catchUp = await db.FeedItems
                .Include(f => f.Subscription)
                .Where(f => f.Subscription.UserId == userId
                         && f.PublishedAt > since
                         && !f.IsCommunityHidden
                         && !f.Subscription.IsCommunityBanned)
                .OrderBy(f => f.PublishedAt)
                .ToListAsync(ct);

            foreach (var item in catchUp)
                await responseStream.WriteAsync(MapCatchUpItem(item), ct);
        }

        // Subscribe to live updates
        var (reader, writer) = broadcaster.Subscribe();
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var evt = await reader.ReadAsync(ct);
                if (userSubIds.Contains(evt.SubscriptionId))
                    await responseStream.WriteAsync(MapBroadcastEvent(evt), ct);
            }
        }
        finally
        {
            broadcaster.Unsubscribe(writer);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static Guid GetUserId(ServerCallContext context)
    {
        var claim = context.GetHttpContext()
            .User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (claim is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Not authenticated"));

        return Guid.Parse(claim);
    }

    private static string EncodeCursor(DateTime publishedAt, Guid id)
        => Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{publishedAt.Ticks}|{id}"));

    private static bool TryParseCursor(string cursor, out DateTime date, out Guid id)
    {
        date = default; id = default;
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            var parts = raw.Split('|');
            if (parts.Length != 2) return false;
            date = new DateTime(long.Parse(parts[0]), DateTimeKind.Utc);
            id   = Guid.Parse(parts[1]);
            return true;
        }
        catch { return false; }
    }

    private static Protos.FeedItem ToProto(
        Entities.FeedItem item,
        HashSet<Guid> readIds,
        HashSet<Guid> likedIds,
        HashSet<Guid> bookmarkIds,
        Dictionary<Guid, int> likeCounts) => new()
    {
        Id             = item.Id.ToString(),
        SubscriptionId = item.SubscriptionId.ToString(),
        Title          = item.Title,
        Url            = item.Url,
        Summary        = item.Summary ?? "",
        PublishedAt    = item.PublishedAt.ToString("o"),
        IsRead         = readIds.Contains(item.Id),
        LikeCount      = likeCounts.GetValueOrDefault(item.Id),
        IsLiked        = likedIds.Contains(item.Id),
        IsBookmarked   = bookmarkIds.Contains(item.Id),
        SourceTitle    = item.Subscription?.Title ?? "",
        ImageUrl       = item.ImageUrl ?? "",
    };

    // New items are never read/liked/bookmarked by definition
    private static Protos.FeedItem MapCatchUpItem(Entities.FeedItem item) => new()
    {
        Id             = item.Id.ToString(),
        SubscriptionId = item.SubscriptionId.ToString(),
        Title          = item.Title,
        Url            = item.Url,
        Summary        = item.Summary ?? "",
        PublishedAt    = item.PublishedAt.ToString("o"),
        IsRead         = false,
        LikeCount      = 0,
        IsLiked        = false,
        IsBookmarked   = false,
        SourceTitle    = item.Subscription?.Title ?? "",
        ImageUrl       = item.ImageUrl ?? "",
    };

    private static Protos.FeedItem MapBroadcastEvent(FeedUpdateEvent evt) => new()
    {
        Id             = evt.Id.ToString(),
        SubscriptionId = evt.SubscriptionId.ToString(),
        Title          = evt.Title,
        Url            = evt.Url,
        Summary        = evt.Summary,
        PublishedAt    = evt.PublishedAt.ToString("o"),
        IsRead         = false,
        LikeCount      = 0,
        IsLiked        = false,
        IsBookmarked   = false,
        SourceTitle    = evt.SourceTitle,
        ImageUrl       = evt.ImageUrl,
    };
}
