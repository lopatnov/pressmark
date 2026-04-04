namespace Pressmark.Api.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string resetUrl, CancellationToken ct);
    Task SendInviteAsync(string toEmail, string token, CancellationToken ct);
    Task SendCommentNotificationAsync(string toEmail, string commenterEmail, string articleTitle, string articleUrl, string commentBody, CancellationToken ct);
    Task SendDailyDigestAsync(string toEmail, string siteUrl, IReadOnlyList<DigestItem> items, CancellationToken ct);
}

public record DigestItem(string Title, string Url, string SourceTitle, int LikeCount);
