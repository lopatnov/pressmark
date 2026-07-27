using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Site configuration surface of the admin API: reading and writing site settings
/// and the manual retention cleanup.
/// </summary>
/// <remarks>
/// Split across partial files by sub-domain:
/// <list type="bullet">
/// <item>AdminServiceImpl.cs — site settings and cleanup (this file)</item>
/// <item>AdminServiceImpl.Users.cs — user administration</item>
/// <item>AdminServiceImpl.Moderation.cs — hiding, banning and reports</item>
/// <item>AdminServiceImpl.Invites.cs — invite tokens</item>
/// </list>
/// The [Authorize] attribute is declared here only — a regression test asserts
/// that exactly one Admin-role attribute is present on the type.
/// </remarks>
[Authorize(Roles = "Admin")]
public partial class AdminServiceImpl(AppDbContext db, ISmtpPasswordProtector passwordProtector, IEmailService emailService, ILogger<AdminServiceImpl> logger) : AdminService.AdminServiceBase
{
    public override async Task<SiteSettings> GetSiteSettings(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var settings = await SiteSettingsSnapshot.LoadAllAsync(db, ct);
        var smtp = SmtpSettings.From(settings);

        return new SiteSettings
        {
            SiteName = settings.SiteName,
            CommunityWindowDays = settings.CommunityWindowDays,
            RegistrationMode = settings.RegistrationMode,
            SmtpHost = smtp.Host,
            SmtpPort = smtp.Port,
            SmtpUser = smtp.User,
            SmtpPassword = "",  // write-only: never returned
            SmtpUseTls = smtp.UseTls,
            SmtpFromAddress = settings.Value(SiteSettingKeys.SmtpFromAddress, ""),
            CommentsEnabled = settings.CommentsEnabled,
            FeedRetentionDays = settings.FeedRetentionDays,
            CommunityPageEnabled = settings.CommunityPageEnabled,
            SiteDescription = settings.SiteDescription,
        };
    }

    public override async Task<Empty> UpdateSiteSettings(UpdateSiteSettingsRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var s = request.Settings;

        if (s.CommunityWindowDays < 0 || s.FeedRetentionDays < 0)
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "community_window_days and feed_retention_days must be non-negative"));

        // Stage every key against one snapshot of the table and commit them together:
        // a save is all-or-nothing, and the whole screen costs two round trips rather
        // than two per setting.
        var existing = await db.SiteSettings.ToDictionaryAsync(x => x.Key, ct);

        void Upsert(string key, string value)
        {
            if (existing.TryGetValue(key, out var setting))
                setting.Value = value;
            else
                db.SiteSettings.Add(new Entities.SiteSetting { Key = key, Value = value });
        }

        Upsert(SiteSettingKeys.SiteName, s.SiteName);
        Upsert(SiteSettingKeys.CommunityWindowDays, s.CommunityWindowDays.ToString());
        Upsert(SiteSettingKeys.RegistrationMode, s.RegistrationMode);
        Upsert(SiteSettingKeys.SmtpHost, s.SmtpHost);
        Upsert(SiteSettingKeys.SmtpPort, s.SmtpPort.ToString());
        Upsert(SiteSettingKeys.SmtpUser, s.SmtpUser);
        Upsert(SiteSettingKeys.SmtpUseTls, s.SmtpUseTls ? "true" : "false");
        Upsert(SiteSettingKeys.SmtpFromAddress, s.SmtpFromAddress);

        // Only update the password if a new value was provided; encrypt before storing
        if (!string.IsNullOrEmpty(s.SmtpPassword))
            Upsert(SiteSettingKeys.SmtpPassword, passwordProtector.Protect(s.SmtpPassword));

        Upsert(SiteSettingKeys.CommentsEnabled, s.CommentsEnabled ? "true" : "false");
        Upsert(SiteSettingKeys.FeedRetentionDays, s.FeedRetentionDays.ToString());
        Upsert(SiteSettingKeys.CommunityPageEnabled, s.CommunityPageEnabled ? "true" : "false");
        Upsert(SiteSettingKeys.SiteDescription, s.SiteDescription);

        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> ClearOldFeeds(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var result = await FeedRetentionCleaner.RunAsync(db, ct);

        logger.LogInformation(
            "Manual cleanup: deleted {Likes} likes older than {Window}d, {Items} feed items older than {Retention}d",
            result.DeletedLikes, result.WindowDays, result.DeletedItems, result.RetentionDays);

        return new Empty();
    }
}
