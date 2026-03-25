using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

public class SmtpEmailService(AppDbContext db, ILogger<SmtpEmailService> logger) : IEmailService
{
    public async Task SendPasswordResetAsync(string toEmail, string resetUrl, CancellationToken ct)
    {
        var settings = await db.SiteSettings
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        var host    = settings.GetValueOrDefault("smtp_host", "");
        var portStr = settings.GetValueOrDefault("smtp_port", "587");
        var user    = settings.GetValueOrDefault("smtp_user", "");
        var pass    = settings.GetValueOrDefault("smtp_password", "");
        var useTls  = settings.GetValueOrDefault("smtp_use_tls", "true") == "true";
        var from    = settings.GetValueOrDefault("smtp_from_address", "noreply@pressmark.local");
        var siteName = settings.GetValueOrDefault("site_name", "Pressmark");

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogWarning("SMTP not configured — skipping password reset email to {Email}", toEmail);
            return;
        }

        var port = int.TryParse(portStr, out var p) ? p : 587;

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"[{siteName}] Password reset";
        message.Body    = new TextPart("plain")
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
}
