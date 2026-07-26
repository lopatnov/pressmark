using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
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
        if (!Guid.TryParse(request.FeedItemId, out var itemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));
        var ct = context.CancellationToken;

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

        await db.SaveChangesAsync(ct);
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
        if (!Guid.TryParse(request.FeedItemId, out var itemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));
        var ct = context.CancellationToken;

        var like = await db.Likes
            .FirstOrDefaultAsync(l => l.UserId == userId && l.FeedItemId == itemId, ct);

        if (like is not null)
            db.Likes.Remove(like);
        else
            db.Likes.Add(new Like { UserId = userId, FeedItemId = itemId });

        await db.SaveChangesAsync(ct);

        var count = await db.Likes.CountAsync(l => l.FeedItemId == itemId, ct);
        var isLiked = like is null; // if we removed it, now not liked; if we added, now liked

        return new ToggleLikeResponse { IsLiked = isLiked, LikeCount = count };
    }

    public override async Task<ToggleBookmarkResponse> ToggleBookmark(
        ToggleBookmarkRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        if (!Guid.TryParse(request.FeedItemId, out var itemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));
        var ct = context.CancellationToken;

        var bookmark = await db.Bookmarks
            .FirstOrDefaultAsync(b => b.UserId == userId && b.FeedItemId == itemId, ct);

        if (bookmark is not null)
            db.Bookmarks.Remove(bookmark);
        else
            db.Bookmarks.Add(new Bookmark { UserId = userId, FeedItemId = itemId });

        await db.SaveChangesAsync(ct);

        return new ToggleBookmarkResponse { IsBookmarked = bookmark is null };
    }
}
