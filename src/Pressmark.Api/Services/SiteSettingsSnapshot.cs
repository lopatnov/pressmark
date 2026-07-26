using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

/// <summary>
/// Canonical keys of the <c>site_settings</c> table. These must stay in sync with
/// the seed data in <see cref="AppDbContext"/>.
/// </summary>
internal static class SiteSettingKeys
{
    internal const string SiteName = "site_name";
    internal const string SiteDescription = "site_description";
    internal const string CommunityWindowDays = "community_window_days";
    internal const string CommunityPageEnabled = "community_page_enabled";
    internal const string RegistrationMode = "registration_mode";
    internal const string CommentsEnabled = "comments_enabled";
    internal const string FeedRetentionDays = "feed_retention_days";
    internal const string SmtpHost = "smtp_host";
    internal const string SmtpPort = "smtp_port";
    internal const string SmtpUser = "smtp_user";
    internal const string SmtpPassword = "smtp_password";
    internal const string SmtpUseTls = "smtp_use_tls";
    internal const string SmtpFromAddress = "smtp_from_address";
}

/// <summary>
/// The SMTP half of the site settings, resolved in one place so the outgoing-mail
/// defaults are shared by every message type.
/// </summary>
/// <remarks>
/// <see cref="ProtectedPassword"/> is still encrypted; callers decrypt it through
/// <see cref="ISmtpPasswordProtector"/>. Note the from-address fallback applies when
/// sending only — the admin settings screen reports an unset address as empty.
/// </remarks>
internal sealed record SmtpSettings(
    string Host,
    int Port,
    string User,
    string ProtectedPassword,
    bool UseTls,
    string FromAddress,
    string SiteName)
{
    /// <summary>True when a host is configured and mail can actually be sent.</summary>
    internal bool IsConfigured => !string.IsNullOrWhiteSpace(Host);

    internal static SmtpSettings From(SiteSettingsSnapshot settings) => new(
        Host: settings.Value(SiteSettingKeys.SmtpHost, ""),
        Port: settings.Int(SiteSettingKeys.SmtpPort, 587),
        User: settings.Value(SiteSettingKeys.SmtpUser, ""),
        ProtectedPassword: settings.Value(SiteSettingKeys.SmtpPassword, ""),
        UseTls: settings.Bool(SiteSettingKeys.SmtpUseTls, true),
        FromAddress: settings.Value(SiteSettingKeys.SmtpFromAddress, "noreply@pressmark.local"),
        SiteName: settings.SiteName);
}

/// <summary>
/// A read-only view over site settings loaded from the database, exposing typed
/// accessors with the canonical fallback for each key.
/// </summary>
/// <remarks>
/// Settings are rows in a key/value table, so every consumer previously repeated
/// the key string, the parse and the default value. Centralising them here keeps
/// the defaults from drifting between the admin UI, the API and the background jobs.
/// </remarks>
internal sealed class SiteSettingsSnapshot(Dictionary<string, string> values)
{
    /// <summary>Loads every setting. Use when most keys are needed.</summary>
    internal static async Task<SiteSettingsSnapshot> LoadAllAsync(
        AppDbContext db, CancellationToken ct) =>
        new(await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value, ct));

    /// <summary>Loads only the requested keys.</summary>
    internal static async Task<SiteSettingsSnapshot> LoadAsync(
        AppDbContext db, string[] keys, CancellationToken ct) =>
        new(await db.SiteSettings
            .Where(s => keys.Contains(s.Key))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct));

    /// <summary>Raw lookup for callers that need a non-canonical fallback.</summary>
    internal string Value(string key, string fallback) => values.GetValueOrDefault(key, fallback);

    internal string SiteName => Value(SiteSettingKeys.SiteName, "Pressmark");

    internal string SiteDescription =>
        Value(SiteSettingKeys.SiteDescription, "A self-hosted RSS reader and community feed");

    internal int CommunityWindowDays => Int(SiteSettingKeys.CommunityWindowDays, 1);

    internal bool CommunityPageEnabled => Bool(SiteSettingKeys.CommunityPageEnabled, true);

    internal string RegistrationMode => Value(SiteSettingKeys.RegistrationMode, "open");

    internal bool CommentsEnabled => Bool(SiteSettingKeys.CommentsEnabled, true);

    internal int FeedRetentionDays => Int(SiteSettingKeys.FeedRetentionDays, 90);

    internal int Int(string key, int fallback) =>
        int.TryParse(values.GetValueOrDefault(key), out var parsed) ? parsed : fallback;

    internal bool Bool(string key, bool fallback) =>
        values.TryGetValue(key, out var raw) ? raw == "true" : fallback;
}
