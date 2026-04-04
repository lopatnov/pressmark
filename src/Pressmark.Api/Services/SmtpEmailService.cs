using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

public class SmtpEmailService(AppDbContext db, ILogger<SmtpEmailService> logger, ISmtpPasswordProtector passwordProtector, IConfiguration config) : IEmailService
{
    public async Task SendPasswordResetAsync(string toEmail, string resetUrl, CancellationToken ct)
    {
        var settings = await db.SiteSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var host = settings.GetValueOrDefault("smtp_host", "");
        var portStr = settings.GetValueOrDefault("smtp_port", "587");
        var user = settings.GetValueOrDefault("smtp_user", "");
        var rawPass = settings.GetValueOrDefault("smtp_password", "");
        var pass = string.IsNullOrEmpty(rawPass) ? "" : passwordProtector.TryUnprotect(rawPass);
        var useTls = settings.GetValueOrDefault("smtp_use_tls", "true") == "true";
        var from = settings.GetValueOrDefault("smtp_from_address", "noreply@pressmark.local");
        var siteName = settings.GetValueOrDefault("site_name", "Pressmark");

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured — skipping password reset email");
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"[{siteName}] Password reset";
        message.Body = new TextPart("plain")
        {
            Text = $"You requested a password reset for {siteName}.\n\n"
                 + $"Click the link below to set a new password (valid for 1 hour):\n\n"
                 + $"{resetUrl}\n\n"
                 + "If you did not request this, you can safely ignore this email.",
        };

        using var client = new SmtpClient();
        var socketOptions = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(host, port, socketOptions, ct);

        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, pass, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }

    public async Task SendInviteAsync(string toEmail, string token, CancellationToken ct)
    {
        var settings = await db.SiteSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var host = settings.GetValueOrDefault("smtp_host", "");
        var portStr = settings.GetValueOrDefault("smtp_port", "587");
        var user = settings.GetValueOrDefault("smtp_user", "");
        var rawPass = settings.GetValueOrDefault("smtp_password", "");
        var pass = string.IsNullOrEmpty(rawPass) ? "" : passwordProtector.TryUnprotect(rawPass);
        var useTls = settings.GetValueOrDefault("smtp_use_tls", "true") == "true";
        var from = settings.GetValueOrDefault("smtp_from_address", "noreply@pressmark.local");
        var siteName = settings.GetValueOrDefault("site_name", "Pressmark");

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured — skipping invite email");
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";
        var registerUrl = $"{baseUrl.TrimEnd('/')}/register?invite_token={Uri.EscapeDataString(token)}";

        message.Subject = $"[{siteName}] You've been invited";
        message.Body = new TextPart("plain")
        {
            Text = $"You have been invited to join {siteName}.\n\n"
                 + $"Click the link below to register (the invite token will be filled in automatically):\n\n"
                 + $"{registerUrl}\n\n"
                 + $"Or enter the token manually: {token}",
        };

        using var client = new SmtpClient();
        var socketOptions = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(host, port, socketOptions, ct);

        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, pass, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }

    public async Task SendCommentNotificationAsync(
        string toEmail,
        string commenterEmail,
        string articleTitle,
        string articleUrl,
        string commentBody,
        CancellationToken ct)
    {
        var settings = await db.SiteSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var host = settings.GetValueOrDefault("smtp_host", "");
        var portStr = settings.GetValueOrDefault("smtp_port", "587");
        var user = settings.GetValueOrDefault("smtp_user", "");
        var rawPass = settings.GetValueOrDefault("smtp_password", "");
        var pass = string.IsNullOrEmpty(rawPass) ? "" : passwordProtector.TryUnprotect(rawPass);
        var useTls = settings.GetValueOrDefault("smtp_use_tls", "true") == "true";
        var from = settings.GetValueOrDefault("smtp_from_address", "noreply@pressmark.local");
        var siteName = settings.GetValueOrDefault("site_name", "Pressmark");

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured — skipping comment notification email");
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"[{siteName}] New comment on \"{articleTitle}\"";
        message.Body = new TextPart("plain")
        {
            Text = $"{commenterEmail} commented on \"{articleTitle}\":\n\n"
                 + $"{commentBody}\n\n"
                 + $"Read the full discussion: {articleUrl}\n\n"
                 + $"To unsubscribe from comment notifications for this article, open the article and click the bell icon.",
        };

        using var client = new SmtpClient();
        var socketOptions = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(host, port, socketOptions, ct);

        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, pass, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }

    public async Task SendDailyDigestAsync(
        string toEmail,
        string siteUrl,
        IReadOnlyList<DigestItem> items,
        CancellationToken ct)
    {
        var settings = await db.SiteSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var host = settings.GetValueOrDefault("smtp_host", "");
        var portStr = settings.GetValueOrDefault("smtp_port", "587");
        var user = settings.GetValueOrDefault("smtp_user", "");
        var rawPass = settings.GetValueOrDefault("smtp_password", "");
        var pass = string.IsNullOrEmpty(rawPass) ? "" : passwordProtector.TryUnprotect(rawPass);
        var useTls = settings.GetValueOrDefault("smtp_use_tls", "true") == "true";
        var from = settings.GetValueOrDefault("smtp_from_address", "noreply@pressmark.local");
        var siteName = settings.GetValueOrDefault("site_name", "Pressmark");

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured — skipping daily digest email");
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"Your daily digest from {siteName} — {DateTime.UtcNow:yyyy-MM-dd}");
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

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"[{siteName}] Daily digest — {DateTime.UtcNow:yyyy-MM-dd}";
        message.Body = new TextPart("plain") { Text = sb.ToString() };

        using var client = new SmtpClient();
        var socketOptions = useTls ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
        await client.ConnectAsync(host, port, socketOptions, ct);

        if (!string.IsNullOrWhiteSpace(user))
            await client.AuthenticateAsync(user, pass, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
