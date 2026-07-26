using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

public class SmtpEmailService(AppDbContext db, ILogger<SmtpEmailService> logger, ISmtpPasswordProtector passwordProtector, IConfiguration config) : IEmailService
{
    public async Task SendPasswordResetAsync(string toEmail, string resetUrl, CancellationToken ct)
    {
        var smtp = await LoadSmtpAsync("password reset email", ct);
        if (smtp is null) return;

        var message = NewMessage(smtp, toEmail, $"[{smtp.SiteName}] Password reset");
        message.Body = new TextPart("plain")
        {
            Text = $"You requested a password reset for {smtp.SiteName}.\n\n"
                 + $"Click the link below to set a new password (valid for 1 hour):\n\n"
                 + $"{resetUrl}\n\n"
                 + "If you did not request this, you can safely ignore this email.",
        };

        await SendAsync(smtp, message, ct);
    }

    public async Task SendInviteAsync(string toEmail, string token, CancellationToken ct)
    {
        var smtp = await LoadSmtpAsync("invite email", ct);
        if (smtp is null) return;

        var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";
        var registerUrl = $"{baseUrl.TrimEnd('/')}/register?invite_token={Uri.EscapeDataString(token)}";

        var message = NewMessage(smtp, toEmail, $"[{smtp.SiteName}] You've been invited");
        message.Body = new TextPart("plain")
        {
            Text = $"You have been invited to join {smtp.SiteName}.\n\n"
                 + $"Click the link below to register (the invite token will be filled in automatically):\n\n"
                 + $"{registerUrl}\n\n"
                 + $"Or enter the token manually: {token}",
        };

        await SendAsync(smtp, message, ct);
    }

    public async Task SendCommentNotificationAsync(
        string toEmail,
        string commenterEmail,
        string articleTitle,
        string articleUrl,
        string commentBody,
        CancellationToken ct)
    {
        var smtp = await LoadSmtpAsync("comment notification email", ct);
        if (smtp is null) return;

        var message = NewMessage(
            smtp, toEmail, $"[{smtp.SiteName}] New comment on \"{articleTitle}\"");
        message.Body = new TextPart("plain")
        {
            Text = $"{commenterEmail} commented on \"{articleTitle}\":\n\n"
                 + $"{commentBody}\n\n"
                 + $"Read the full discussion: {articleUrl}\n\n"
                 + $"To unsubscribe from comment notifications for this article, open the article and click the bell icon.",
        };

        await SendAsync(smtp, message, ct);
    }

    public async Task SendDailyDigestAsync(
        string toEmail,
        string siteUrl,
        IReadOnlyList<DigestItem> items,
        CancellationToken ct)
    {
        var smtp = await LoadSmtpAsync("daily digest email", ct);
        if (smtp is null) return;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"Your daily digest from {smtp.SiteName} — {DateTime.UtcNow:yyyy-MM-dd}");
        sb.AppendLine();

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            sb.AppendLine($"{i + 1}. {item.Title}");
            sb.AppendLine($"   Source: {item.SourceTitle}  |  Likes: {item.LikeCount}");
            sb.AppendLine($"   {item.Url}");
            sb.AppendLine();
        }

        sb.AppendLine($"To unsubscribe from the daily digest, open {siteUrl.TrimEnd('/')}/subscriptions and toggle the digest switch.");

        var message = NewMessage(
            smtp, toEmail, $"[{smtp.SiteName}] Daily digest — {DateTime.UtcNow:yyyy-MM-dd}");
        message.Body = new TextPart("plain") { Text = sb.ToString() };

        await SendAsync(smtp, message, ct);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Reads the SMTP configuration, returning <c>null</c> (and logging) when no host
    /// is configured, which is the signal for callers to skip sending entirely.
    /// </summary>
    private async Task<SmtpSettings?> LoadSmtpAsync(string emailDescription, CancellationToken ct)
    {
        var smtp = SmtpSettings.From(await SiteSettingsSnapshot.LoadAllAsync(db, ct));

        if (!smtp.IsConfigured)
        {
            logger.LogWarning("SMTP not configured — skipping {EmailDescription}", emailDescription);
            return null;
        }

        return smtp;
    }

    private static MimeMessage NewMessage(SmtpSettings smtp, string toEmail, string subject)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(smtp.FromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        return message;
    }

    private async Task SendAsync(SmtpSettings smtp, MimeMessage message, CancellationToken ct)
    {
        using var client = new SmtpClient();
        var socketOptions = smtp.UseTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(smtp.Host, smtp.Port, socketOptions, ct);

        if (!string.IsNullOrWhiteSpace(smtp.User))
        {
            var password = string.IsNullOrEmpty(smtp.ProtectedPassword)
                ? ""
                : passwordProtector.TryUnprotect(smtp.ProtectedPassword);
            await client.AuthenticateAsync(smtp.User, password, ct);
        }

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
