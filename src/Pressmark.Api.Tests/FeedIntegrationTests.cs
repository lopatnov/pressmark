using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Entities;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// Integration tests for feed query logic: moderation isolation, community time window,
/// and cursor pagination stability. Run against a real SQL Server instance.
/// Skipped silently when TEST_MSSQL_CONNECTION_STRING is not set.
/// </summary>
public class FeedIntegrationTests(IntegrationFixture fixture) : IClassFixture<IntegrationFixture>
{
    // ── helpers ──────────────────────────────────────────────────────────────

    private static User MakeUser() => new()
    {
        Email = $"{Guid.NewGuid()}@test.com",
        PasswordHash = "x",
    };

    private static Subscription MakeSub(Guid userId) => new()
    {
        UserId = userId,
        RssUrl = $"https://{Guid.NewGuid()}.example.com/feed",
        Title = "Test",
    };

    private static FeedItem MakeItem(Guid subId, DateTime? publishedAt = null,
        bool hidden = false) => new()
        {
            SubscriptionId = subId,
            Title = "Test article",
            Url = $"https://example.com/{Guid.NewGuid()}",
            PublishedAt = publishedAt ?? DateTime.UtcNow,
            IsCommunityHidden = hidden,
        };

    // ── isolation: personal feed must not be affected by IsCommunityHidden ──

    /// <summary>
    /// Regression for PR #2 where IsCommunityHidden leaked into the personal feed.
    /// Personal feed must return items regardless of the moderation flag;
    /// community feed must exclude them.
    /// </summary>
    [Fact]
    public async Task PersonalFeed_Shows_HiddenItem_CommunityFeed_Does_Not()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);
        var sub = MakeSub(user.Id);
        db.Subscriptions.Add(sub);
        var item = MakeItem(sub.Id, hidden: true);
        db.FeedItems.Add(item);
        await db.SaveChangesAsync();

        // Add a like within the time window so the item qualifies for community feed
        // if it were not hidden
        db.Likes.Add(new Like { UserId = user.Id, FeedItemId = item.Id });
        await db.SaveChangesAsync();

        // Personal feed query (exact query from FeedServiceImpl.GetFeed)
        var personalIds = await db.FeedItems
            .Where(f => f.Subscription.UserId == user.Id)
            .Select(f => f.Id)
            .ToListAsync();

        Assert.Contains(item.Id, personalIds);

        // Community feed query (exact query from FeedServiceImpl.GetCommunityFeed)
        var since = DateTime.UtcNow.AddDays(-2);
        var communityIds = await db.FeedItems
            .Where(f => !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned
                     && db.Likes.Any(l => l.FeedItemId == f.Id && l.CreatedAt >= since))
            .Select(f => f.Id)
            .ToListAsync();

        Assert.DoesNotContain(item.Id, communityIds);
    }

    /// <summary>
    /// Banned subscription: items must not appear in community feed, but still
    /// visible in the owner's personal feed.
    /// </summary>
    [Fact]
    public async Task PersonalFeed_Shows_BannedSubItem_CommunityFeed_Does_Not()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);
        var sub = MakeSub(user.Id);
        sub.IsCommunityBanned = true;
        db.Subscriptions.Add(sub);
        var item = MakeItem(sub.Id);
        db.FeedItems.Add(item);
        await db.SaveChangesAsync();

        db.Likes.Add(new Like { UserId = user.Id, FeedItemId = item.Id });
        await db.SaveChangesAsync();

        var personalIds = await db.FeedItems
            .Where(f => f.Subscription.UserId == user.Id)
            .Select(f => f.Id)
            .ToListAsync();
        Assert.Contains(item.Id, personalIds);

        var since = DateTime.UtcNow.AddDays(-2);
        var communityIds = await db.FeedItems
            .Where(f => !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned
                     && db.Likes.Any(l => l.FeedItemId == f.Id && l.CreatedAt >= since))
            .Select(f => f.Id)
            .ToListAsync();
        Assert.DoesNotContain(item.Id, communityIds);
    }

    // ── community time window ─────────────────────────────────────────────────

    /// <summary>
    /// Article liked 8 days ago with community_window_days=7 must NOT appear;
    /// article liked today must appear.
    /// </summary>
    [Fact]
    public async Task CommunityFeed_TimeWindow_FiltersOldLikes()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);
        var sub = MakeSub(user.Id);
        db.Subscriptions.Add(sub);

        var oldItem = MakeItem(sub.Id, publishedAt: DateTime.UtcNow.AddDays(-10));
        var newItem = MakeItem(sub.Id, publishedAt: DateTime.UtcNow);
        db.FeedItems.AddRange(oldItem, newItem);
        await db.SaveChangesAsync();

        // Like old item 8 days ago (outside a 7-day window)
        db.Likes.Add(new Like
        {
            UserId = user.Id,
            FeedItemId = oldItem.Id,
            CreatedAt = DateTime.UtcNow.AddDays(-8),
        });
        // Like new item just now
        db.Likes.Add(new Like
        {
            UserId = user.Id,
            FeedItemId = newItem.Id,
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();

        // community_window_days = 7
        var since = DateTime.UtcNow.AddDays(-7);
        var communityIds = await db.FeedItems
            .Where(f => !f.IsCommunityHidden
                     && !f.Subscription.IsCommunityBanned
                     && db.Likes.Any(l => l.FeedItemId == f.Id && l.CreatedAt >= since))
            .Select(f => f.Id)
            .ToListAsync();

        Assert.DoesNotContain(oldItem.Id, communityIds);
        Assert.Contains(newItem.Id, communityIds);
    }

    // ── cursor pagination stability ───────────────────────────────────────────

    /// <summary>
    /// Page 1 is fetched; then a like is added to an item on page 1 (which would
    /// change like_count but NOT published_at). Page 2 must contain no duplicates
    /// and no missing items compared to a full single-page fetch.
    /// </summary>
    [Fact]
    public async Task CursorPagination_NoGaps_NoduplicatesAfterLikeChange()
    {
        if (!fixture.IsAvailable) return;

        await using var db = fixture.CreateContext();

        var user = MakeUser();
        db.Users.Add(user);
        var sub = MakeSub(user.Id);
        db.Subscriptions.Add(sub);

        // Insert 6 items with distinct published_at timestamps 1 minute apart
        var baseTime = new DateTime(2024, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        var items = Enumerable.Range(0, 6)
            .Select(i => MakeItem(sub.Id, publishedAt: baseTime.AddMinutes(-(i * 2))))
            .ToList();
        db.FeedItems.AddRange(items);
        await db.SaveChangesAsync();

        // Sort the way the service does: PublishedAt DESC, Id DESC
        var sorted = items
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .ToList();

        // Page 1: first 3 items
        var page1Items = sorted.Take(3).ToList();
        var lastOnPage1 = page1Items.Last();
        var cursor = CursorHelper.Encode(lastOnPage1.PublishedAt, lastOnPage1.Id);

        // Add a like to the first item on page 1 — this changes like_count but
        // published_at/id remain the same, so the cursor boundary should be stable
        db.Likes.Add(new Like { UserId = user.Id, FeedItemId = page1Items.First().Id });
        await db.SaveChangesAsync();

        // Page 2: query using cursor
        var ok = CursorHelper.TryParse(cursor, out var cursorDate, out var cursorId);
        Assert.True(ok);

        var page2Items = await db.FeedItems
            .Where(f => f.Subscription.UserId == user.Id)
            .Where(f => f.PublishedAt < cursorDate
                     || (f.PublishedAt == cursorDate && f.Id.CompareTo(cursorId) < 0))
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(3)
            .Select(f => f.Id)
            .ToListAsync();

        var page1Ids = page1Items.Select(f => f.Id).ToHashSet();
        var page2Ids = page2Items.ToHashSet();

        // No overlaps between pages
        Assert.Empty(page1Ids.Intersect(page2Ids));

        // Together they cover all 6 items
        Assert.Equal(6, page1Ids.Union(page2Ids).Count());
    }
}
