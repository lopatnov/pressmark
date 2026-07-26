using System.Linq.Expressions;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Projections from entities onto the admin protobuf messages.
/// </summary>
/// <remarks>
/// Some admin endpoints project inside a database query and others map entities
/// already in memory. Where both are needed the projection is declared once as an
/// <see cref="Expression"/> — so EF Core can translate it to SQL — and compiled
/// for the in-memory callers, which keeps the two paths from drifting apart.
/// </remarks>
internal static class AdminMapper
{
    internal static readonly Expression<Func<Entities.User, UserInfo>> UserInfoProjection =
        u => new UserInfo
        {
            Id = u.Id.ToString(),
            Email = u.Email,
            Role = u.Role,
            CreatedAt = u.CreatedAt.ToString("O"),
            IsCommentingBanned = u.IsCommentingBanned,
            IsSiteBanned = u.IsSiteBanned,
        };

    internal static readonly Expression<Func<Entities.FeedItem, HiddenFeedItem>> HiddenFeedItemProjection =
        f => new HiddenFeedItem
        {
            Id = f.Id.ToString(),
            Title = f.Title,
            Url = f.Url,
            SourceTitle = f.Subscription.Title,
        };

    private static readonly Func<Entities.User, UserInfo> ToUserInfoCompiled =
        UserInfoProjection.Compile();

    internal static UserInfo ToUserInfo(Entities.User user) => ToUserInfoCompiled(user);

    internal static BannedSubscription ToBannedSubscription(Entities.Subscription s) => new()
    {
        Id = s.Id.ToString(),
        RssUrl = s.RssUrl,
        Title = s.Title,
    };

    internal static UserSubscriptionInfo ToUserSubscriptionInfo(Entities.Subscription s) => new()
    {
        Id = s.Id.ToString(),
        RssUrl = s.RssUrl,
        Title = s.Title,
        IsCommunityBanned = s.IsCommunityBanned,
    };

    internal static UserCommentInfo ToUserCommentInfo(Entities.Comment c) => new()
    {
        Id = c.Id.ToString(),
        Body = c.RemovedByAdmin ? "" : c.Body,
        CreatedAt = c.CreatedAt.ToString("O"),
        FeedItemId = c.FeedItemId.ToString(),
        FeedItemTitle = c.FeedItem?.Title ?? "",
        RemovedByAdmin = c.RemovedByAdmin,
    };

    /// <summary>
    /// Projects an invite. The raw token is supplied by the caller because it is
    /// returned once on creation and never exposed again by the list endpoint.
    /// </summary>
    internal static Protos.InviteToken ToInviteToken(Entities.InviteToken t, string token) => new()
    {
        Id = t.Id.ToString(),
        Token = token,
        Note = t.Note ?? "",
        CreatedAt = t.CreatedAt.ToString("O"),
        IsUsed = false,
        ExpiresAt = t.ExpiresAt?.ToString("O") ?? "",
    };

    /// <summary>
    /// Projects the report itself. The reported content is attached separately by
    /// the caller, which batch-loads comments and subscriptions.
    /// </summary>
    internal static Protos.Report ToReport(Entities.Report r) => new()
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
}
