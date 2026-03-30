namespace Pressmark.Api.Services;

public interface IEmailService
{
    Task SendPasswordResetAsync(string toEmail, string resetUrl, CancellationToken ct);
    Task SendInviteAsync(string toEmail, string token, CancellationToken ct);
}
