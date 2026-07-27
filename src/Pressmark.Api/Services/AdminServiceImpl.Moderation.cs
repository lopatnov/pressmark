using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Moderation: hiding articles from the community feed, banning sources, removing
/// comments and working through the user-submitted report queue.
/// See AdminServiceImpl.cs for the primary constructor.
/// </summary>
public partial class AdminServiceImpl
{
    public override async Task<Empty> HideFeedItem(HideFeedItemRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var id = RpcGuards.ParseId(request.FeedItemId, "feed_item_id");

        var item = await db.FeedItems.FindOrThrowAsync(id, "Feed item not found", ct);

        item.IsCommunityHidden = request.Hidden;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> BanSubscription(BanSubscriptionRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var id = RpcGuards.ParseId(request.SubscriptionId, "subscription_id");

        var sub = await db.Subscriptions.FindOrThrowAsync(id, "Subscription not found", ct);

        sub.IsCommunityBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> RemoveComment(
        RemoveCommentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var id = RpcGuards.ParseId(request.CommentId, "comment_id");

        var comment = await db.Comments.FindOrThrowAsync(id, "Comment not found", ct);

        comment.RemovedByAdmin = true;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<BannedSubscriptionList> ListBannedSubscriptions(
        ListBannedSubscriptionsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var (page, pageSize) = AdminPaging.Normalize(request.Page, request.PageSize);

        var query = db.Subscriptions
            .Where(s => s.IsCommunityBanned)
            .OrderBy(s => s.Title);

        var total = await query.CountAsync(ct);
        var subs = await query
            .ToPage(page, pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var result = new BannedSubscriptionList { TotalCount = total };
        result.Items.AddRange(subs.Select(AdminMapper.ToBannedSubscription));
        return result;
    }

    public override async Task<HiddenFeedItemList> ListHiddenFeedItems(
        ListHiddenFeedItemsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var (page, pageSize) = AdminPaging.Normalize(request.Page, request.PageSize);

        var query = db.FeedItems
            .Where(f => f.IsCommunityHidden)
            .OrderByDescending(f => f.PublishedAt);

        var total = await query.CountAsync(ct);
        var items = await query
            .ToPage(page, pageSize)
            .AsNoTracking()
            .Select(AdminMapper.HiddenFeedItemProjection)
            .ToListAsync(ct);

        var result = new HiddenFeedItemList { TotalCount = total };
        result.Items.AddRange(items);
        return result;
    }

    public override async Task<PendingReportCount> GetPendingReportCount(
        Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var count = await db.Reports.CountAsync(r => !r.IsResolved, ct);
        return new PendingReportCount { Count = count };
    }

    public override async Task<ReportList> ListReports(
        ListReportsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var (page, pageSize) = AdminPaging.Normalize(request.Page, request.PageSize);

        var query = db.Reports
            .Include(r => r.Reporter)
            .Where(r => !r.IsResolved)
            .OrderByDescending(r => r.CreatedAt);

        var total = await query.CountAsync(ct);
        var reports = await query
            .ToPage(page, pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        // Batch-load related entities
        var commentIds = reports.Where(r => r.Type == ReportTypes.Comment).Select(r => r.TargetId).ToHashSet();
        var subIds = reports.Where(r => r.Type == ReportTypes.Subscription).Select(r => r.TargetId).ToHashSet();

        var comments = commentIds.Count > 0
            ? await db.Comments
                .Include(c => c.FeedItem)
                .Include(c => c.User)
                .Where(c => commentIds.Contains(c.Id))
                .AsNoTracking()
                .ToDictionaryAsync(c => c.Id, ct)
            : [];

        var subs = subIds.Count > 0
            ? await db.Subscriptions
                .Where(s => subIds.Contains(s.Id))
                .AsNoTracking()
                .ToDictionaryAsync(s => s.Id, ct)
            : [];

        var result = new ReportList { TotalCount = total };
        result.Items.AddRange(reports.Select(r =>
        {
            var proto = AdminMapper.ToReport(r);

            if (r.Type == ReportTypes.Comment && comments.TryGetValue(r.TargetId, out var comment))
            {
                proto.Content = comment.RemovedByAdmin ? "" : comment.Body;
                proto.ArticleId = comment.FeedItemId.ToString();
                proto.TargetUserEmail = comment.User?.Email ?? "";
            }
            else if (r.Type == ReportTypes.Subscription && subs.TryGetValue(r.TargetId, out var sub))
            {
                proto.Content = sub.Title;
                proto.ContentUrl = sub.RssUrl;
            }

            return proto;
        }));
        return result;
    }

    public override async Task<Empty> ResolveReport(
        ResolveReportRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var id = RpcGuards.ParseId(request.Id, "id");

        var report = await db.Reports.FindOrThrowAsync(id, "Report not found", ct);

        report.IsResolved = true;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }
}
