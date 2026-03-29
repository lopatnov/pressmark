using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

[Authorize]
public class FeedServiceImpl(AppDbContext db, IDbContextFactory<AppDbContext> dbFactory, FeedUpdateBroadcaster broadcaster) : FeedService.FeedServiceBase
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public override async Task<FeedPage> GetFeed(
        GetFeedRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var query = db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => f.Subscription.UserId == userId);

        if (!string.IsNullOrEmpty(request.SubscriptionId)
            && Guid.TryParse(request.SubscriptionId, out var subId))
            query = query.Where(f => f.SubscriptionId == subId);

        if (request.UnreadOnly)
            query = query.Where(f =>
                !db.ReadItems.Any(r => r.UserId == userId && r.FeedItemId == f.Id));

        // Decode cursor: "publishedAt_ticks|id"
        if (!string.IsNullOrEmpty(request.Cursor) && CursorHelper.TryParse(request.Cursor,
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

        var hasMore = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();

        return await BuildPageResponseAsync(pageItems, hasMore, userId,
            allBookmarked: false, includeTotalUnread: string.IsNullOrEmpty(request.Cursor), ct);
    }

    public override async Task<Empty> MarkAsRead(
        MarkAsReadRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
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
        var userId = GetUserId(context);
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
        var userId = GetUserId(context);
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
        var userId = GetUserId(context);
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
        var userId = GetUserId(context);
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

    public override async Task<FeedPage> GetBookmarks(
        GetBookmarksRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var query = db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => db.Bookmarks.Any(b => b.UserId == userId && b.FeedItemId == f.Id));

        if (!string.IsNullOrEmpty(request.SubscriptionId))
            query = query.Where(f => f.SubscriptionId == Guid.Parse(request.SubscriptionId));

        if (!string.IsNullOrEmpty(request.Cursor) && CursorHelper.TryParse(request.Cursor,
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

        var hasMore = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();

        return await BuildPageResponseAsync(pageItems, hasMore, userId,
            allBookmarked: true, includeTotalUnread: false, ct);
    }

    [AllowAnonymous]
    public override async Task<FeedPage> GetCommunityFeed(
        GetCommunityFeedRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = Math.Clamp(request.PageSize == 0 ? DefaultPageSize : request.PageSize,
                                  1, MaxPageSize);

        var windowDaysStr = await db.SiteSettings
            .Where(s => s.Key == "community_window_days")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct) ?? "1";

        var windowDays = int.TryParse(windowDaysStr, out var d) ? d : 1;
        var since = DateTime.UtcNow.AddDays(-windowDays);

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

        if (!string.IsNullOrEmpty(request.Cursor) && CursorHelper.TryParse(request.Cursor,
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

        var hasMore = items.Count > pageSize;
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
        if (claim != null && Guid.TryParse(claim, out var parsedId)) userId = parsedId;

        HashSet<Guid> likedIds = [];
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
            page.NextCursor = CursorHelper.Encode(last.PublishedAt, last.Id);
        }

        return page;
    }

    public override async Task StreamFeedUpdates(
        StreamFeedRequest request,
        IServerStreamWriter<Protos.FeedItem> responseStream,
        ServerCallContext context)
    {
        var userId = GetUserId(context);
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
            while (await reader.WaitToReadAsync(ct))
            {
                while (reader.TryRead(out var evt))
                {
                    if (userSubIds.Contains(evt.SubscriptionId))
                    {
                        await responseStream.WriteAsync(MapBroadcastEvent(evt), ct);
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            //logger.LogInformation("Client disconnected from feed stream.");
        }
        catch (Exception)
        {
            //logger.LogError(ex, "Unexpected error in feed stream.");
            throw;
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

    private static Protos.FeedItem ToProto(
        Entities.FeedItem item,
        HashSet<Guid> readIds,
        HashSet<Guid> likedIds,
        HashSet<Guid> bookmarkIds,
        Dictionary<Guid, int> likeCounts) => new()
        {
            Id = item.Id.ToString(),
            SubscriptionId = item.SubscriptionId.ToString(),
            Title = item.Title,
            Url = item.Url,
            Summary = item.Summary ?? "",
            PublishedAt = item.PublishedAt.ToString("o"),
            IsRead = readIds.Contains(item.Id),
            LikeCount = likeCounts.GetValueOrDefault(item.Id),
            IsLiked = likedIds.Contains(item.Id),
            IsBookmarked = bookmarkIds.Contains(item.Id),
            SourceTitle = item.Subscription?.Title ?? "",
            ImageUrl = item.ImageUrl ?? "",
            SourceRssUrl = item.Subscription?.RssUrl ?? "",
            IsSourceBanned = item.Subscription?.IsCommunityBanned ?? false,
        };

    // New items are never read/liked/bookmarked by definition
    private static Protos.FeedItem MapCatchUpItem(Entities.FeedItem item) => new()
    {
        Id = item.Id.ToString(),
        SubscriptionId = item.SubscriptionId.ToString(),
        Title = item.Title,
        Url = item.Url,
        Summary = item.Summary ?? "",
        PublishedAt = item.PublishedAt.ToString("o"),
        IsRead = false,
        LikeCount = 0,
        IsLiked = false,
        IsBookmarked = false,
        SourceTitle = item.Subscription?.Title ?? "",
        ImageUrl = item.ImageUrl ?? "",
        SourceRssUrl = item.Subscription?.RssUrl ?? "",
        IsSourceBanned = item.Subscription?.IsCommunityBanned ?? false,
    };

    private static Protos.FeedItem MapBroadcastEvent(FeedUpdateEvent evt) => new()
    {
        Id = evt.Id.ToString(),
        SubscriptionId = evt.SubscriptionId.ToString(),
        Title = evt.Title,
        Url = evt.Url,
        Summary = evt.Summary,
        PublishedAt = evt.PublishedAt.ToString("o"),
        IsRead = false,
        LikeCount = 0,
        IsLiked = false,
        IsBookmarked = false,
        SourceTitle = evt.SourceTitle,
        ImageUrl = evt.ImageUrl,
        IsSourceBanned = false, // streaming is pre-filtered to exclude banned sources
    };

    [AllowAnonymous]
    public override async Task<CommentList> ListComments(
        ListCommentsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.FeedItemId, out var feedItemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));

        var comments = await db.Comments
            .AsNoTracking()
            .Where(c => c.FeedItemId == feedItemId)
            .OrderBy(c => c.CreatedAt)
            .Include(c => c.User)
            .Take(200)
            .ToListAsync(ct);

        var result = new CommentList();
        result.Items.AddRange(comments.Select(c => new Protos.Comment
        {
            Id = c.Id.ToString(),
            UserEmail = c.RemovedByAdmin ? "" : c.User.Email,
            Body = c.RemovedByAdmin ? "" : c.Body,
            CreatedAt = c.CreatedAt.ToString("o"),
            RemovedByAdmin = c.RemovedByAdmin,
            IsCommentingBanned = c.RemovedByAdmin ? false : c.User.IsCommentingBanned,
        }));
        return result;
    }

    public override async Task<Protos.Comment> AddComment(
        AddCommentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = GetUserId(context);

        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 1000)
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "Comment body must be between 1 and 1000 characters"));

        if (!Guid.TryParse(request.FeedItemId, out var feedItemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));

        var commentsEnabled = await db.SiteSettings
            .Where(s => s.Key == "comments_enabled")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct) ?? "true";

        if (commentsEnabled != "true")
            throw new RpcException(new Status(StatusCode.FailedPrecondition, "Comments are disabled"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.Unauthenticated, "User not found"));

        if (user.IsCommentingBanned)
            throw new RpcException(new Status(StatusCode.PermissionDenied, "You are not allowed to comment"));

        var feedItemExists = await db.FeedItems.AnyAsync(f => f.Id == feedItemId, ct);
        if (!feedItemExists)
            throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        var comment = new Entities.Comment
        {
            UserId = userId,
            FeedItemId = feedItemId,
            Body = request.Body.Trim(),
        };

        db.Comments.Add(comment);
        await db.SaveChangesAsync(ct);

        return new Protos.Comment
        {
            Id = comment.Id.ToString(),
            UserEmail = user.Email,
            Body = comment.Body,
            CreatedAt = comment.CreatedAt.ToString("o"),
            RemovedByAdmin = false,
            IsCommentingBanned = user.IsCommentingBanned,
        };
    }

    [AllowAnonymous]
    public override async Task<Protos.FeedItem> GetFeedItem(
        GetFeedItemRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.FeedItemId, out var feedItemId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));

        var isAdmin = context.GetHttpContext().User.IsInRole("Admin");

        var item = await db.FeedItems
            .AsNoTracking()
            .Include(f => f.Subscription)
            .Where(f => f.Id == feedItemId
                     && (isAdmin || (!f.IsCommunityHidden && !f.Subscription.IsCommunityBanned)))
            .FirstOrDefaultAsync(ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        var ids = new List<Guid> { feedItemId };

        var likeCount = await db.Likes.CountAsync(l => l.FeedItemId == feedItemId, ct);

        Guid? userId = null;
        var claim = context.GetHttpContext().User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (claim != null && Guid.TryParse(claim, out var parsedId)) userId = parsedId;

        var isLiked = userId.HasValue &&
            await db.Likes.AnyAsync(l => l.UserId == userId && l.FeedItemId == feedItemId, ct);
        var isBookmarked = userId.HasValue &&
            await db.Bookmarks.AnyAsync(b => b.UserId == userId && b.FeedItemId == feedItemId, ct);
        var isRead = userId.HasValue &&
            await db.ReadItems.AnyAsync(r => r.UserId == userId && r.FeedItemId == feedItemId, ct);

        var likeCounts = new Dictionary<Guid, int> { [feedItemId] = likeCount };
        var likedIds = isLiked ? new HashSet<Guid> { feedItemId } : new HashSet<Guid>();
        var bookmarkIds = isBookmarked ? new HashSet<Guid> { feedItemId } : new HashSet<Guid>();
        var readIds = isRead ? new HashSet<Guid> { feedItemId } : new HashSet<Guid>();

        var proto = ToProto(item, readIds, likedIds, bookmarkIds, likeCounts);
        if (isAdmin) proto.IsHidden = item.IsCommunityHidden;
        return proto;
    }

    public override async Task<Empty> ReportContent(
        ReportContentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = GetUserId(context);

        if (request.Type != "comment" && request.Type != "subscription")
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "type must be 'comment' or 'subscription'"));

        if (!Guid.TryParse(request.TargetId, out var targetId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid target_id"));

        // Verify target exists
        if (request.Type == "comment")
        {
            var exists = await db.Comments.AnyAsync(c => c.Id == targetId && !c.RemovedByAdmin, ct);
            if (!exists)
                throw new RpcException(new Status(StatusCode.NotFound, "Comment not found"));
        }
        else
        {
            var exists = await db.Subscriptions.AnyAsync(s => s.Id == targetId, ct);
            if (!exists)
                throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));
        }

        // Idempotent: no-op if already reported
        var alreadyReported = await db.Reports.AnyAsync(
            r => r.ReporterUserId == userId && r.TargetId == targetId, ct);
        if (alreadyReported)
            return new Empty();

        db.Reports.Add(new Entities.Report
        {
            ReporterUserId = userId,
            Type = request.Type,
            TargetId = targetId,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
        });
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    /// <summary>
    /// Enriches a page of feed items with per-user read/like/bookmark state and assembles a FeedPage.
    /// </summary>
    /// <param name="allBookmarked">When true (GetBookmarks), all items are bookmarked by definition.</param>
    /// <param name="includeTotalUnread">When true (GetFeed), compute and set TotalUnread.</param>
    private async Task<FeedPage> BuildPageResponseAsync(
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
        await using var ctx3 = await dbFactory.CreateDbContextAsync(ct);
        await using var ctx4 = await dbFactory.CreateDbContextAsync(ct);

        var readIdsTask = ctx1.ReadItems
            .Where(r => r.UserId == userId && ids.Contains(r.FeedItemId))
            .Select(r => r.FeedItemId).ToHashSetAsync(ct);
        var likedIdsTask = ctx2.Likes
            .Where(l => l.UserId == userId && ids.Contains(l.FeedItemId))
            .Select(l => l.FeedItemId).ToHashSetAsync(ct);
        var bookmarkIdsTask = allBookmarked
            ? Task.FromResult(ids.ToHashSet())
            : ctx3.Bookmarks
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
            page.Items.Add(ToProto(item, readIds, likedIds, bookmarkIds, likeCounts));

        if (hasMore)
        {
            var last = pageItems.Last();
            page.NextCursor = CursorHelper.Encode(last.PublishedAt, last.Id);
        }

        return page;
    }
}
