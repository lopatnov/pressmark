using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Community interaction surface of the feed API: article comments, comment
/// subscriptions and user-submitted content reports.
/// See FeedServiceImpl.cs for the primary constructor and the read endpoints.
/// </summary>
public partial class FeedServiceImpl
{
    [AllowAnonymous]
    public override async Task<CommentList> ListComments(
        ListCommentsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var feedItemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");

        var comments = await db.Comments
            .AsNoTracking()
            .Where(c => c.FeedItemId == feedItemId)
            .OrderBy(c => c.CreatedAt)
            .Include(c => c.User)
            .Take(200)
            .ToListAsync(ct);

        var userId = context.TryGetUserId();

        var isSubscribed = userId.HasValue &&
            await db.CommentSubscriptions.AnyAsync(
                s => s.UserId == userId.Value && s.FeedItemId == feedItemId, ct);

        var result = new CommentList { IsSubscribed = isSubscribed };
        result.Items.AddRange(comments.Select(c => new Protos.Comment
        {
            Id = c.Id.ToString(),
            UserEmail = c.RemovedByAdmin ? "" : c.User.Email,
            Body = c.RemovedByAdmin ? "" : c.Body,
            CreatedAt = c.CreatedAt.ToString("o"),
            RemovedByAdmin = c.RemovedByAdmin,
            IsCommentingBanned = !c.RemovedByAdmin && c.User.IsCommentingBanned,
        }));
        return result;
    }

    public override async Task<Protos.Comment> AddComment(
        AddCommentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = context.GetUserId();

        if (string.IsNullOrWhiteSpace(request.Body) || request.Body.Length > 1000)
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "Comment body must be between 1 and 1000 characters"));

        var feedItemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");

        var settings = await SiteSettingsSnapshot.LoadAsync(
            db, [SiteSettingKeys.CommentsEnabled], ct);

        if (!settings.CommentsEnabled)
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

        var feedItem = await db.FeedItems.FindAsync([feedItemId], ct);
        if (feedItem != null)
            NotifySubscribersInBackground(feedItemId, user.Email, feedItem.Title, comment.Body);

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

    /// <summary>
    /// Sends the "new comment" emails without holding up the comment write.
    /// </summary>
    /// <remarks>
    /// Safe to detach from the request: <see cref="CommentNotificationService"/> is a
    /// singleton that opens its own DI scope, so nothing it touches is disposed when this
    /// RPC returns. The wrapper exists to observe the task — a discarded one would let any
    /// fault escape as an unobserved exception — and delivery failures are non-fatal, the
    /// comment is already committed.
    /// </remarks>
    private void NotifySubscribersInBackground(
        Guid feedItemId, string commenterEmail, string articleTitle, string commentBody)
    {
        _ = RunAsync();

        async Task RunAsync()
        {
            try
            {
                await commentNotifications.NotifySubscribersAsync(
                    feedItemId, commenterEmail, articleTitle, commentBody);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex,
                    "Comment notification fan-out failed for feed item {FeedItemId}", feedItemId);
            }
        }
    }

    public override async Task<ToggleCommentSubscriptionResponse> ToggleCommentSubscription(
        ToggleCommentSubscriptionRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = context.GetUserId();

        var feedItemId = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");

        var existing = await db.CommentSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.FeedItemId == feedItemId, ct);

        if (existing != null)
        {
            db.CommentSubscriptions.Remove(existing);
            await db.SaveChangesAsync(ct);
            return new ToggleCommentSubscriptionResponse { Subscribed = false };
        }

        var feedItemExists = await db.FeedItems.AnyAsync(f => f.Id == feedItemId, ct);
        if (!feedItemExists)
            throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        db.CommentSubscriptions.Add(new Entities.CommentSubscription
        {
            UserId = userId,
            FeedItemId = feedItemId,
        });
        await db.SaveChangesAsync(ct);
        return new ToggleCommentSubscriptionResponse { Subscribed = true };
    }

    public override async Task<Empty> ReportContent(
        ReportContentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var userId = context.GetUserId();

        if (request.Type != "comment" && request.Type != "subscription")
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "type must be 'comment' or 'subscription'"));

        var targetId = RpcGuards.ParseId(request.TargetId, "target_id");

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
}
