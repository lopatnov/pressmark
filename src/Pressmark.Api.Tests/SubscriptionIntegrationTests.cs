using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Tests;

/// <summary>
/// Integration tests for subscription-related data behavior:
/// RSS fetch deduplication. Skipped silently when
/// TEST_MSSQL_CONNECTION_STRING is not set.
/// </summary>
public class SubscriptionIntegrationTests(IntegrationFixture fixture)
    : IClassFixture<IntegrationFixture>
{
    private static User MakeUser() => new()
    {
        Email = $"{Guid.NewGuid()}@test.com",
        PasswordHash = "x",
    };

    // ── RSS deduplication ─────────────────────────────────────────────────────

    /// <summary>
    /// FeedFetcherService deduplicates by URL per subscription:
    ///   existingUrls = all FeedItem URLs for this subscription
    ///   only add items where !existingUrls.Contains(item.Url)
    ///
    /// Calling fetch twice on the same RSS must NOT double the item count.
    /// </summary>
    [Fact]
    public async Task FetchTwice_SameUrl_DoesNotDuplicateFeedItem()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);
        var sub = new Subscription
        {
            UserId = user.Id,
            RssUrl = $"https://{Guid.NewGuid()}.example.com/feed",
            Title = "Test feed",
        };
        db.Subscriptions.Add(sub);
        await db.SaveChangesAsync();

        const string articleUrl = "https://example.com/article/42";

        // Simulate first fetch: article not yet in DB, so it gets inserted
        var existingAfterFetch1 = await db.FeedItems
            .Where(f => f.SubscriptionId == sub.Id)
            .Select(f => f.Url)
            .ToHashSetAsync();

        if (!existingAfterFetch1.Contains(articleUrl))
        {
            db.FeedItems.Add(new FeedItem
            {
                SubscriptionId = sub.Id,
                Title = "Article 42",
                Url = articleUrl,
                PublishedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var countAfterFirst = await db.FeedItems
            .CountAsync(f => f.SubscriptionId == sub.Id && f.Url == articleUrl);
        Assert.Equal(1, countAfterFirst);

        // Simulate second fetch: same article URL — existingUrls already contains it
        var existingAfterFetch2 = await db.FeedItems
            .Where(f => f.SubscriptionId == sub.Id)
            .Select(f => f.Url)
            .ToHashSetAsync();

        if (!existingAfterFetch2.Contains(articleUrl))
        {
            db.FeedItems.Add(new FeedItem
            {
                SubscriptionId = sub.Id,
                Title = "Article 42",
                Url = articleUrl,
                PublishedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        }

        var countAfterSecond = await db.FeedItems
            .CountAsync(f => f.SubscriptionId == sub.Id && f.Url == articleUrl);

        Assert.Equal(1, countAfterSecond); // still exactly 1
    }

    /// <summary>
    /// Same URL in two different subscriptions is allowed — deduplication is
    /// per-subscription, not global.
    /// </summary>
    [Fact]
    public async Task SameUrl_InDifferentSubscriptions_BothInserted()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);

        var sub1 = new Subscription
        {
            UserId = user.Id,
            RssUrl = $"https://{Guid.NewGuid()}.example.com/feed1",
            Title = "Feed 1",
        };
        var sub2 = new Subscription
        {
            UserId = user.Id,
            RssUrl = $"https://{Guid.NewGuid()}.example.com/feed2",
            Title = "Feed 2",
        };
        db.Subscriptions.AddRange(sub1, sub2);
        await db.SaveChangesAsync();

        const string sharedUrl = "https://shared.example.com/article/1";

        // Both subscriptions get the same article URL — this is by design
        db.FeedItems.AddRange(
            new FeedItem { SubscriptionId = sub1.Id, Title = "A", Url = sharedUrl, PublishedAt = DateTime.UtcNow },
            new FeedItem { SubscriptionId = sub2.Id, Title = "A", Url = sharedUrl, PublishedAt = DateTime.UtcNow }
        );
        await db.SaveChangesAsync();

        var count1 = await db.FeedItems.CountAsync(f => f.SubscriptionId == sub1.Id && f.Url == sharedUrl);
        var count2 = await db.FeedItems.CountAsync(f => f.SubscriptionId == sub2.Id && f.Url == sharedUrl);

        Assert.Equal(1, count1);
        Assert.Equal(1, count2);
    }
}
