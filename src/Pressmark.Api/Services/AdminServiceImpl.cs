using System.Security.Claims;
using System.Security.Cryptography;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

[Authorize(Roles = "Admin")]
public class AdminServiceImpl(AppDbContext db, ISmtpPasswordProtector passwordProtector, IEmailService emailService, ILogger<AdminServiceImpl> logger) : AdminService.AdminServiceBase
{
    public override async Task<SiteSettings> GetSiteSettings(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var settings = await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        return new SiteSettings
        {
            SiteName = settings.GetValueOrDefault("site_name", "Pressmark"),
            CommunityWindowDays = int.TryParse(settings.GetValueOrDefault("community_window_days"), out var d) ? d : 1,
            RegistrationMode = settings.GetValueOrDefault("registration_mode", "open"),
            SmtpHost = settings.GetValueOrDefault("smtp_host", ""),
            SmtpPort = int.TryParse(settings.GetValueOrDefault("smtp_port"), out var p) ? p : 587,
            SmtpUser = settings.GetValueOrDefault("smtp_user", ""),
            SmtpPassword = "",  // write-only: never returned
            SmtpUseTls = settings.GetValueOrDefault("smtp_use_tls", "true") == "true",
            SmtpFromAddress = settings.GetValueOrDefault("smtp_from_address", ""),
            CommentsEnabled = settings.GetValueOrDefault("comments_enabled", "true") == "true",
            FeedRetentionDays = int.TryParse(settings.GetValueOrDefault("feed_retention_days"), out var r) ? r : 90,
            CommunityPageEnabled = settings.GetValueOrDefault("community_page_enabled", "true") == "true",
        };
    }

    public override async Task<Empty> UpdateSiteSettings(UpdateSiteSettingsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var s = request.Settings;

        await UpsertSetting("site_name", s.SiteName, ct);
        await UpsertSetting("community_window_days", s.CommunityWindowDays.ToString(), ct);
        await UpsertSetting("registration_mode", s.RegistrationMode, ct);
        await UpsertSetting("smtp_host", s.SmtpHost, ct);
        await UpsertSetting("smtp_port", s.SmtpPort.ToString(), ct);
        await UpsertSetting("smtp_user", s.SmtpUser, ct);
        await UpsertSetting("smtp_use_tls", s.SmtpUseTls ? "true" : "false", ct);
        await UpsertSetting("smtp_from_address", s.SmtpFromAddress, ct);

        // Only update the password if a new value was provided; encrypt before storing
        if (!string.IsNullOrEmpty(s.SmtpPassword))
            await UpsertSetting("smtp_password", passwordProtector.Protect(s.SmtpPassword), ct);

        await UpsertSetting("comments_enabled", s.CommentsEnabled ? "true" : "false", ct);
        await UpsertSetting("feed_retention_days", s.FeedRetentionDays.ToString(), ct);
        await UpsertSetting("community_page_enabled", s.CommunityPageEnabled ? "true" : "false", ct);

        return new Empty();
    }

    public override async Task<Empty> HideFeedItem(HideFeedItemRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.FeedItemId, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));

        var item = await db.FeedItems.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        item.IsCommunityHidden = request.Hidden;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> BanSubscription(BanSubscriptionRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.SubscriptionId, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid subscription_id"));

        var sub = await db.Subscriptions.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));

        sub.IsCommunityBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<UserList> ListUsers(ListUsersRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 100) : 20;
        var page = Math.Max(0, request.Page);

        var query = db.Users.OrderBy(u => u.CreatedAt);
        var total = await query.CountAsync(ct);
        var users = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .Select(u => new UserInfo
            {
                Id = u.Id.ToString(),
                Email = u.Email,
                Role = u.Role,
                CreatedAt = u.CreatedAt.ToString("O"),
                IsCommentingBanned = u.IsCommentingBanned,
                IsSiteBanned = u.IsSiteBanned,
            })
            .ToListAsync(ct);

        var result = new UserList { TotalCount = total };
        result.Users.AddRange(users);
        return result;
    }

    public override async Task<BannedSubscriptionList> ListBannedSubscriptions(
        ListBannedSubscriptionsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 100) : 20;
        var page = Math.Max(0, request.Page);

        var query = db.Subscriptions
            .Where(s => s.IsCommunityBanned)
            .OrderBy(s => s.Title);

        var total = await query.CountAsync(ct);
        var subs = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        var result = new BannedSubscriptionList { TotalCount = total };
        result.Items.AddRange(subs.Select(s => new BannedSubscription
        {
            Id = s.Id.ToString(),
            RssUrl = s.RssUrl,
            Title = s.Title,
        }));
        return result;
    }

    public override async Task<Empty> RemoveComment(
        RemoveCommentRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.CommentId, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid comment_id"));

        var comment = await db.Comments.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Comment not found"));

        comment.RemovedByAdmin = true;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> BanUserFromCommenting(
        BanUserFromCommentingRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        user.IsCommentingBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Protos.InviteToken> GenerateInvite(
        GenerateInviteRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

        var entity = new Entities.InviteToken
        {
            Token = token,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            ExpiresAt = request.ExpiresDays > 0
                ? DateTime.UtcNow.AddDays(request.ExpiresDays)
                : (DateTime?)null,
        };

        db.InviteTokens.Add(entity);
        await db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(request.NotifyEmail))
        {
            try
            {
                await emailService.SendInviteAsync(request.NotifyEmail, token, ct);
            }
            catch (Exception ex)
            {
                // Non-fatal: log and continue; the token is still returned to the admin
                logger.LogWarning(ex, "Failed to send invite email to {Email}", request.NotifyEmail);
            }
        }

        return new Protos.InviteToken
        {
            Id = entity.Id.ToString(),
            Token = token,   // returned once only
            Note = entity.Note ?? "",
            CreatedAt = entity.CreatedAt.ToString("O"),
            IsUsed = false,
            ExpiresAt = entity.ExpiresAt?.ToString("O") ?? "",
        };
    }

    public override async Task<Empty> DeleteInvite(
        DeleteInviteRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.Id, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid id"));

        var entity = await db.InviteTokens.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Invite not found"));

        db.InviteTokens.Remove(entity);
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<InviteList> ListInvites(
        ListInvitesRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 100) : 20;
        var page = Math.Max(0, request.Page);

        var query = db.InviteTokens
            .Where(t => !t.IsUsed && (t.ExpiresAt == null || t.ExpiresAt > DateTime.UtcNow))
            .OrderByDescending(t => t.CreatedAt);

        var total = await query.CountAsync(ct);
        var invites = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var result = new InviteList { TotalCount = total };
        result.Items.AddRange(invites.Select(t => new Protos.InviteToken
        {
            Id = t.Id.ToString(),
            Token = "",   // not exposed in list
            Note = t.Note ?? "",
            CreatedAt = t.CreatedAt.ToString("O"),
            IsUsed = false,
            ExpiresAt = t.ExpiresAt?.ToString("O") ?? "",
        }));
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
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 100) : 20;
        var page = Math.Max(0, request.Page);

        var query = db.Reports
            .Include(r => r.Reporter)
            .Where(r => !r.IsResolved)
            .OrderByDescending(r => r.CreatedAt);

        var total = await query.CountAsync(ct);
        var reports = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .ToListAsync(ct);

        // Batch-load related entities
        var commentIds = reports.Where(r => r.Type == "comment").Select(r => r.TargetId).ToHashSet();
        var subIds = reports.Where(r => r.Type == "subscription").Select(r => r.TargetId).ToHashSet();

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
            var proto = new Protos.Report
            {
                Id = r.Id.ToString(),
                Type = r.Type,
                TargetId = r.TargetId.ToString(),
                Reason = r.Reason ?? "",
                CreatedAt = r.CreatedAt.ToString("O"),
                IsResolved = r.IsResolved,
                ReporterEmail = r.Reporter?.Email ?? "",
                ReporterJoined = r.Reporter?.CreatedAt.ToString("O") ?? "",
            };

            if (r.Type == "comment" && comments.TryGetValue(r.TargetId, out var comment))
            {
                proto.Content = comment.RemovedByAdmin ? "" : comment.Body;
                proto.ArticleId = comment.FeedItemId.ToString();
                proto.TargetUserEmail = comment.User?.Email ?? "";
            }
            else if (r.Type == "subscription" && subs.TryGetValue(r.TargetId, out var sub))
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

        if (!Guid.TryParse(request.Id, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid id"));

        var report = await db.Reports.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Report not found"));

        report.IsResolved = true;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<HiddenFeedItemList> ListHiddenFeedItems(
        ListHiddenFeedItemsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var pageSize = request.PageSize > 0 ? Math.Min(request.PageSize, 100) : 20;
        var page = Math.Max(0, request.Page);

        var query = db.FeedItems
            .Where(f => f.IsCommunityHidden)
            .OrderByDescending(f => f.PublishedAt);

        var total = await query.CountAsync(ct);
        var items = await query
            .Skip(page * pageSize)
            .Take(pageSize)
            .AsNoTracking()
            .Select(f => new HiddenFeedItem
            {
                Id = f.Id.ToString(),
                Title = f.Title,
                Url = f.Url,
                SourceTitle = f.Subscription.Title,
            })
            .ToListAsync(ct);

        var result = new HiddenFeedItemList { TotalCount = total };
        result.Items.AddRange(items);
        return result;
    }

    public override async Task<Empty> SitebanUser(SitebanUserRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        user.IsSiteBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> DeleteUser(DeleteUserRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        var callerIdStr = context.GetHttpContext().User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (callerIdStr != null && Guid.TryParse(callerIdStr, out var callerId) && callerId == userId)
            throw new RpcException(new Status(StatusCode.FailedPrecondition, "Cannot delete your own account"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        if (user.Role == "Admin")
        {
            var adminCount = await db.Users.CountAsync(u => u.Role == "Admin", ct);
            if (adminCount <= 1)
                throw new RpcException(new Status(StatusCode.FailedPrecondition, "Cannot delete the last admin"));
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Manually delete entities with NoAction FK constraints
        await db.ReadItems.Where(r => r.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Likes.Where(l => l.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Bookmarks.Where(b => b.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Comments.Where(c => c.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Reports.Where(r => r.ReporterUserId == userId).ExecuteDeleteAsync(ct);

        db.Users.Remove(user);
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> ChangeUserRole(ChangeUserRoleRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        if (request.Role != "User" && request.Role != "Admin")
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Role must be 'User' or 'Admin'"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        if (user.Role == "Admin" && request.Role == "User")
        {
            var adminCount = await db.Users.CountAsync(u => u.Role == "Admin", ct);
            if (adminCount <= 1)
                throw new RpcException(new Status(StatusCode.FailedPrecondition, "Cannot demote the last admin"));
        }

        user.Role = request.Role;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<UserDetails> GetUserDetails(GetUserDetailsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid user_id"));

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        var subscriptions = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Title)
            .AsNoTracking()
            .ToListAsync(ct);

        var comments = await db.Comments
            .Include(c => c.FeedItem)
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .Take(50)
            .AsNoTracking()
            .ToListAsync(ct);

        var details = new UserDetails
        {
            User = new UserInfo
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                Role = user.Role,
                CreatedAt = user.CreatedAt.ToString("O"),
                IsCommentingBanned = user.IsCommentingBanned,
                IsSiteBanned = user.IsSiteBanned,
            },
        };

        details.Subscriptions.AddRange(subscriptions.Select(s => new UserSubscriptionInfo
        {
            Id = s.Id.ToString(),
            RssUrl = s.RssUrl,
            Title = s.Title,
            IsCommunityBanned = s.IsCommunityBanned,
        }));

        details.Comments.AddRange(comments.Select(c => new UserCommentInfo
        {
            Id = c.Id.ToString(),
            Body = c.RemovedByAdmin ? "" : c.Body,
            CreatedAt = c.CreatedAt.ToString("O"),
            FeedItemId = c.FeedItemId.ToString(),
            FeedItemTitle = c.FeedItem?.Title ?? "",
            RemovedByAdmin = c.RemovedByAdmin,
        }));

        return details;
    }

    private async Task UpsertSetting(string key, string value, CancellationToken ct)
    {
        var setting = await db.SiteSettings.FindAsync([key], ct);
        if (setting is null)
            db.SiteSettings.Add(new Entities.SiteSetting { Key = key, Value = value });
        else
            setting.Value = value;

        await db.SaveChangesAsync(ct);
    }

    public override async Task<Empty> ClearOldFeeds(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var settings = await db.SiteSettings
            .Where(s => s.Key == "community_window_days" || s.Key == "feed_retention_days")
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var windowDays = int.TryParse(settings.GetValueOrDefault("community_window_days"), out var w) ? w : 1;
        var retentionDays = int.TryParse(settings.GetValueOrDefault("feed_retention_days"), out var r) ? r : 90;

        // Delete likes older than community window
        var likeCutoff = DateTime.UtcNow.AddDays(-windowDays);
        var deletedLikes = await db.Likes
            .Where(l => l.CreatedAt < likeCutoff)
            .ExecuteDeleteAsync(ct);

        // Delete feed items older than retention period that have no bookmark
        var itemCutoff = DateTime.UtcNow.AddDays(-retentionDays);
        var toDelete = await db.FeedItems
            .Where(f => f.FetchedAt < itemCutoff && !f.Bookmarks.Any())
            .Select(f => f.Id)
            .ToListAsync(ct);

        var deletedItems = 0;
        foreach (var batch in toDelete.Chunk(500))
        {
            deletedItems += await db.FeedItems
                .Where(f => batch.Contains(f.Id))
                .ExecuteDeleteAsync(ct);
        }

        logger.LogInformation(
            "Manual cleanup: deleted {Likes} likes older than {Window}d, {Items} feed items older than {Retention}d",
            deletedLikes, windowDays, deletedItems, retentionDays);

        return new Empty();
    }
}
