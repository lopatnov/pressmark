using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// The snapshot exists so the fallback for each setting is stated once instead of
/// being repeated at every call site. These pin the fallbacks and the parsing that
/// decides when one applies — an unconfigured instance runs entirely on them.
/// </summary>
public class SiteSettingsSnapshotTests
{
    private static SiteSettingsSnapshot Snapshot(params (string Key, string Value)[] values) =>
        new(values.ToDictionary(v => v.Key, v => v.Value));

    // ── canonical fallbacks ───────────────────────────────────────────────────

    [Fact]
    public void EmptySnapshot_ReportsTheSeededDefaults()
    {
        var settings = Snapshot();

        Assert.Equal("Pressmark", settings.SiteName);
        Assert.Equal(1, settings.CommunityWindowDays);
        Assert.Equal("open", settings.RegistrationMode);
        Assert.True(settings.CommentsEnabled);
        Assert.Equal(90, settings.FeedRetentionDays);
        Assert.True(settings.CommunityPageEnabled);
    }

    [Fact]
    public void StoredValues_WinOverTheFallbacks()
    {
        var settings = Snapshot(
            (SiteSettingKeys.SiteName, "My Reader"),
            (SiteSettingKeys.CommunityWindowDays, "7"),
            (SiteSettingKeys.RegistrationMode, "invite_only"),
            (SiteSettingKeys.CommentsEnabled, "false"),
            (SiteSettingKeys.FeedRetentionDays, "30"),
            (SiteSettingKeys.CommunityPageEnabled, "false"));

        Assert.Equal("My Reader", settings.SiteName);
        Assert.Equal(7, settings.CommunityWindowDays);
        Assert.Equal("invite_only", settings.RegistrationMode);
        Assert.False(settings.CommentsEnabled);
        Assert.Equal(30, settings.FeedRetentionDays);
        Assert.False(settings.CommunityPageEnabled);
    }

    // ── parsing ───────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("TRUE")]
    [InlineData("True")]
    [InlineData("true")]
    public void Bool_IsCaseInsensitive(string stored)
    {
        // Parsed rather than compared to "true", so a value written with different
        // casing does not silently read as false and turn the setting off.
        Assert.True(Snapshot((SiteSettingKeys.CommentsEnabled, stored)).CommentsEnabled);
    }

    [Theory]
    [InlineData("")]
    [InlineData("yes")]
    public void Bool_UnparseableValue_FallsBack(string stored)
    {
        Assert.True(Snapshot((SiteSettingKeys.CommentsEnabled, stored)).CommentsEnabled);
        Assert.False(Snapshot(("x", stored)).Bool("x", fallback: false));
    }

    [Fact]
    public void Int_UnparseableValue_FallsBack()
    {
        Assert.Equal(90, Snapshot((SiteSettingKeys.FeedRetentionDays, "soon")).FeedRetentionDays);
    }

    [Fact]
    public void Value_MissingKey_ReturnsTheCallerSuppliedFallback()
    {
        Assert.Equal("none", Snapshot().Value(SiteSettingKeys.SmtpHost, "none"));
    }

    // ── SMTP projection ───────────────────────────────────────────────────────

    [Fact]
    public void SmtpSettings_WithoutAHost_IsNotConfigured()
    {
        Assert.False(SmtpSettings.From(Snapshot()).IsConfigured);
        Assert.False(SmtpSettings.From(Snapshot((SiteSettingKeys.SmtpHost, "   "))).IsConfigured);
    }

    [Fact]
    public void SmtpSettings_Defaults_AreSubmissionPortOverTls()
    {
        var smtp = SmtpSettings.From(Snapshot((SiteSettingKeys.SmtpHost, "mail.example.com")));

        Assert.True(smtp.IsConfigured);
        Assert.Equal(587, smtp.Port);
        Assert.True(smtp.UseTls);
        Assert.Equal("noreply@pressmark.local", smtp.FromAddress);
    }
}
