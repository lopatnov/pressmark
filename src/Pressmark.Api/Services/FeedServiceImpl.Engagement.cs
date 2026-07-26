using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Engagement surface of the feed API: per-user read state, likes and bookmarks.
/// See FeedServiceImpl.cs for the primary constructor and the read endpoints.
/// </summary>
public partial class FeedServiceImpl
{
    public override async Task<Empty> MarkAsRead(
        MarkAsReadRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var itemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");
        var ct = context.CancellationToken;

        var exists = await db.ReadItems
            .AnyAsync(r => r.UserId == userId && r.FeedItemId == itemId, ct);

        if (!exists)
        {
            db.ReadItems.Add(new ReadItem { UserId = userId, FeedItemId = itemId });
            await SaveEngagementAsync(ct);
        }

        return new Empty();
    }

    public override async Task<Empty> MarkAllAsRead(
        MarkAllAsReadRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

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

        await SaveEngagementAsync(ct);
        return new Empty();
    }

    public override async Task<UnreadCount> GetUnreadCount(
        Empty request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var count = await db.FeedItems
            .CountAsync(f => f.Subscription.UserId == userId
                          && !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id),
                        ct);

        return new UnreadCount { Count = count };
    }

    public override async Task<ToggleLikeResponse> ToggleLike(
        ToggleLikeRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var itemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");
        var ct = context.CancellationToken;

        var like = await db.Likes
            .FirstOrDefaultAsync(l => l.UserId == userId && l.FeedItemId == itemId, ct);

        if (like is not null)
            db.Likes.Remove(like);
        else
            db.Likes.Add(new Like { UserId = userId, FeedItemId = itemId });

        await SaveEngagementAsync(ct);

        var count = await db.Likes.CountAsync(l => l.FeedItemId == itemId, ct);
        var isLiked = like is null; // if we removed it, now not liked; if we added, now liked

        return new ToggleLikeResponse { IsLiked = isLiked, LikeCount = count };
    }

    public override async Task<ToggleBookmarkResponse> ToggleBookmark(
        ToggleBookmarkRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var itemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");
        var ct = context.CancellationToken;

        var bookmark = await db.Bookmarks
            .FirstOrDefaultAsync(b => b.UserId == userId && b.FeedItemId == itemId, ct);

        if (bookmark is not null)
            db.Bookmarks.Remove(bookmark);
        else
            db.Bookmarks.Add(new Bookmark { UserId = userId, FeedItemId = itemId });

        await SaveEngagementAsync(ct);

        return new ToggleBookmarkResponse { IsBookmarked = bookmark is null };
    }

    /// <summary>
    /// Commits an engagement write that is idempotent by nature — the read/like/bookmark
    /// tables record presence, not a count — and tolerates losing a race to an identical
    /// concurrent request (a double tap or a client retry).
    /// </summary>
    /// <remarks>
    /// The endpoints decide what to write from a preceding read, which is not atomic with
    /// the write. A duplicate request can therefore try to insert a row that now exists
    /// (composite-key violation) or delete one that is already gone (zero rows affected).
    /// Both mean the caller's intended end state is already in place, so they are reported
    /// as success instead of surfacing as an Unknown RPC fault.
    /// </remarks>
    private async Task SaveEngagementAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex is DbUpdateConcurrencyException || IsDuplicateKey(ex))
        {
            // Drop the entries the failed save left pending so nothing is retried later
            // in the request against a row another caller now owns.
            db.ChangeTracker.Clear();
        }
    }

    /// <summary>Unique index (2601) and primary key (2627) violations.</summary>
    private static bool IsDuplicateKey(DbUpdateException ex) =>
        (ex.InnerException as SqlException)?.Number is 2601 or 2627;
}
