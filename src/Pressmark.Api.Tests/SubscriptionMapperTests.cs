using Pressmark.Api.Entities;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// Which title a subscription reports is a rule, not a formatting detail: the user's
/// own DisplayName overrides the one the feed declares, and every endpoint returning
/// a subscription has to agree on that.
/// </summary>
public class SubscriptionMapperTests
{
    private static Subscription MakeSub(string? displayName = null) => new()
    {
        Id = Guid.NewGuid(),
        UserId = Guid.NewGuid(),
        RssUrl = "https://example.com/feed",
        Title = "Feed title",
        DisplayName = displayName,
    };

    [Fact]
    public void ToProto_WithoutADisplayName_UsesTheFeedTitle()
    {
        Assert.Equal("Feed title", SubscriptionMapper.ToProto(MakeSub()).Title);
    }

    [Fact]
    public void ToProto_WithADisplayName_PrefersIt()
    {
        Assert.Equal("My name", SubscriptionMapper.ToProto(MakeSub("My name")).Title);
    }

    [Fact]
    public void ToProto_NeverFetched_ReportsAnEmptyTimestamp()
    {
        var proto = SubscriptionMapper.ToProto(MakeSub());

        Assert.Equal("", proto.LastFetchedAt);
    }

    [Fact]
    public void ToProto_Fetched_RoundTripsTheTimestamp()
    {
        var sub = MakeSub();
        sub.LastFetchedAt = new DateTime(2024, 6, 15, 10, 30, 0, DateTimeKind.Utc);

        var proto = SubscriptionMapper.ToProto(sub);

        Assert.Equal(sub.LastFetchedAt.Value, DateTime.Parse(proto.LastFetchedAt).ToUniversalTime());
    }

    [Fact]
    public void ToProto_CarriesIdentityAndModerationState()
    {
        var sub = MakeSub();
        sub.IsCommunityBanned = true;

        var proto = SubscriptionMapper.ToProto(sub);

        Assert.Equal(sub.Id.ToString(), proto.Id);
        Assert.Equal(sub.UserId.ToString(), proto.UserId);
        Assert.Equal(sub.RssUrl, proto.RssUrl);
        Assert.True(proto.IsCommunityBanned);
    }
}
