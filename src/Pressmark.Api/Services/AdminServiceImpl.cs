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

        await UpsertSetting(SiteSettingKeys.SiteName, s.SiteName, ct);
        await UpsertSetting(SiteSettingKeys.CommunityWindowDays, s.CommunityWindowDays.ToString(), ct);
        await UpsertSetting(SiteSettingKeys.RegistrationMode, s.RegistrationMode, ct);
        await UpsertSetting(SiteSettingKeys.SmtpHost, s.SmtpHost, ct);
        await UpsertSetting(SiteSettingKeys.SmtpPort, s.SmtpPort.ToString(), ct);
        await UpsertSetting(SiteSettingKeys.SmtpUser, s.SmtpUser, ct);
        await UpsertSetting(SiteSettingKeys.SmtpUseTls, s.SmtpUseTls ? "true" : "false", ct);
        await UpsertSetting(SiteSettingKeys.SmtpFromAddress, s.SmtpFromAddress, ct);

        // Only update the password if a new value was provided; encrypt before storing
        if (!string.IsNullOrEmpty(s.SmtpPassword))
            await UpsertSetting(SiteSettingKeys.SmtpPassword, passwordProtector.Protect(s.SmtpPassword), ct);

        await UpsertSetting(SiteSettingKeys.CommentsEnabled, s.CommentsEnabled ? "true" : "false", ct);
        await UpsertSetting(SiteSettingKeys.FeedRetentionDays, s.FeedRetentionDays.ToString(), ct);
        await UpsertSetting(SiteSettingKeys.CommunityPageEnabled, s.CommunityPageEnabled ? "true" : "false", ct);
        await UpsertSetting(SiteSettingKeys.SiteDescription, s.SiteDescription, ct);

        return new Empty();
    }

    public override async Task<Empty> ClearOldFeeds(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var settings = await SiteSettingsSnapshot.LoadAsync(db, [
            SiteSettingKeys.CommunityWindowDays,
            SiteSettingKeys.FeedRetentionDays,
        ], ct);

        var windowDays = settings.CommunityWindowDays;
        var retentionDays = settings.FeedRetentionDays;

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

    private async Task UpsertSetting(string key, string value, CancellationToken ct)
    {
        var setting = await db.SiteSettings.FindAsync([key], ct);
        if (setting is null)
            db.SiteSettings.Add(new Entities.SiteSetting { Key = key, Value = value });
        else
            setting.Value = value;

        await db.SaveChangesAsync(ct);
    }
}
