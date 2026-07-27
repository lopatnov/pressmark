using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Read side of the feed API: the personal feed, bookmarks, the public community
/// feed, single articles and the live update stream. Query composition lives here;
/// response assembly is delegated to <see cref="FeedPageAssembler"/> and projection
/// to <see cref="FeedItemMapper"/>.
/// </summary>
/// <remarks>
/// Split across partial files by sub-domain:
/// <list type="bullet">
/// <item>FeedServiceImpl.cs — reads and streaming (this file)</item>
/// <item>FeedServiceImpl.Engagement.cs — read state, likes and bookmarks</item>
/// <item>FeedServiceImpl.Comments.cs — comments and content reporting</item>
/// </list>
/// </remarks>
[Authorize]
public partial class FeedServiceImpl(
    AppDbContext db,
    FeedUpdateBroadcaster broadcaster,
    FeedPageAssembler pageAssembler,
    CommentNotificationService commentNotifications,
    ILogger<FeedServiceImpl> logger) : FeedService.FeedServiceBase
{
    public override async Task<FeedPage> GetFeed(
        GetFeedRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;
        var pageSize = FeedQueryExtensions.ClampPageSize(request.PageSize);

        var query = db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => f.Subscription.UserId == userId);

        if (!string.IsNullOrEmpty(request.SubscriptionId))
        {
            var subscriptionId = RpcGuards.ParseId(request.SubscriptionId, "subscription_id");
            query = query.Where(f => f.SubscriptionId == subscriptionId);
        }

        if (request.UnreadOnly)
            query = query.Where(f =>
                !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id));

        var (pageItems, hasMore) = await query
            .ApplyCursor(request.Cursor)
            .ToPageAsync(pageSize, ct);

        return await pageAssembler.AssembleUserPageAsync(pageItems, hasMore, userId,
            allBookmarked: false, includeTotalUnread: string.IsNullOrEmpty(request.Cursor), ct);
    }

    public override async Task<FeedPage> GetBookmarks(
        GetBookmarksRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;
        var pageSize = FeedQueryExtensions.ClampPageSize(request.PageSize);

        var query = db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => db.Bookmarks.Any(b => b.UserId == userId && b.FeedItemId == f.Id));

        if (!string.IsNullOrEmpty(request.SubscriptionId))
        {
            var subscriptionId = RpcGuards.ParseId(request.SubscriptionId, "subscription_id");
            query = query.Where(f => f.SubscriptionId == subscriptionId);
        }

        var (pageItems, hasMore) = await query
            .ApplyCursor(request.Cursor)
            .ToPageAsync(pageSize, ct);

        return await pageAssembler.AssembleUserPageAsync(pageItems, hasMore, userId,
            allBookmarked: true, includeTotalUnread: false, ct);
    }

    [AllowAnonymous]
    public override async Task<FeedPage> GetCommunityFeed(
        GetCommunityFeedRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = FeedQueryExtensions.ClampPageSize(request.PageSize);

        var settings = await SiteSettingsSnapshot.LoadAsync(
            db, [SiteSettingKeys.CommunityWindowDays], ct);
        var since = DateTime.UtcNow.AddDays(-settings.CommunityWindowDays);

        var query = db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned
                     && db.Likes.Any(l => l.FeedItemId == f.Id
                         && l.CreatedAt >= since
                         && !db.Users.Any(u => u.Id == l.UserId && u.IsSiteBanned)));

        if (!string.IsNullOrEmpty(request.SourceRssUrl))
            query = query.Where(f => f.Subscription.RssUrl == request.SourceRssUrl);

        var (pageItems, hasMore) = await query
            .ApplyCursor(request.Cursor)
            .ToPageAsync(pageSize, ct);

        return await pageAssembler.AssembleCommunityPageAsync(
            pageItems, hasMore, context.TryGetUserId(), ct);
    }

    [AllowAnonymous]
    public override async Task<Protos.FeedItem> GetFeedItem(
        GetFeedItemRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var feedItemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");

        var isAdmin = context.GetHttpContext().User.IsInRole(UserRoles.Admin);

        var item = await db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => f.Id == feedItemId
                     && (isAdmin || (!f.IsCommunityHidden && !f.Subscription.IsCommunityBanned)))
            .FirstOrDefaultAsync(ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        var likeCount = await db.Likes.CountAsync(l => l.FeedItemId == feedItemId, ct);

        var userId = context.TryGetUserId();

        var isLiked = userId.HasValue &&
            await db.Likes.AnyAsync(l => l.UserId == userId && l.FeedItemId == feedItemId, ct);
        var isBookmarked = userId.HasValue &&
            await db.Bookmarks.AnyAsync(b => b.UserId == userId && b.FeedItemId == feedItemId, ct);
        var isRead = userId.HasValue &&
            await db.ReadItems.AnyAsync(r => r.UserId == userId && r.FeedItemId == feedItemId, ct);

        var likeCounts = new Dictionary<Guid, int> { [feedItemId] = likeCount };
        var likedIds = isLiked ? new HashSet<Guid> { feedItemId } : [];
        var bookmarkIds = isBookmarked ? new HashSet<Guid> { feedItemId } : [];
        var readIds = isRead ? new HashSet<Guid> { feedItemId } : [];

        var proto = FeedItemMapper.ToProto(item, readIds, likedIds, bookmarkIds, likeCounts);
        if (isAdmin) proto.IsHidden = item.IsCommunityHidden;
        return proto;
    }

    public override async Task StreamFeedUpdates(
        StreamFeedRequest request,
        IServerStreamWriter<Protos.FeedItem> responseStream,
        ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

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
                .AsNoTracking()
                .Include(f => f.Subscription)
                .Where(f => f.Subscription.UserId == userId
                         && f.PublishedAt > since
                         && !f.IsCommunityHidden
                         && !f.Subscription.IsCommunityBanned)
                .OrderBy(f => f.PublishedAt)
                .ToListAsync(ct);

            foreach (var item in catchUp)
                await responseStream.WriteAsync(FeedItemMapper.ToCatchUpProto(item), ct);
        }

        // Subscribe to live updates
        var (reader, writer) = broadcaster.Subscribe();
        try
        {
            while (await reader.WaitToReadAsync(ct))
            {
                while (reader.TryRead(out var evt))
                {
                    if (userSubIds.Contains(evt.SubscriptionId))
                    {
                        await responseStream.WriteAsync(FeedItemMapper.ToBroadcastProto(evt), ct);
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Client disconnected; not an error.
        }
        finally
        {
            broadcaster.Unsubscribe(writer);
        }
    }
}
