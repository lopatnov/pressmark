using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

public class DailyDigestService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<DailyDigestService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await SendDigestsAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task SendDigestsAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

            var todayUtc = DateTime.UtcNow.Date;

            var users = await db.Users
                .AsNoTracking()
                .Where(u => u.DigestEnabled
                    && !u.IsSiteBanned
                    && (u.LastDigestSentAt == null || u.LastDigestSentAt < todayUtc))
                .Select(u => new { u.Id, u.Email, u.LastDigestSentAt })
                .ToListAsync(ct);

            if (users.Count == 0) return;

            var windowDays = 1;
            var windowSetting = await db.SiteSettings
                .Where(s => s.Key == "community_window_days")
                .Select(s => s.Value)
                .FirstOrDefaultAsync(ct);
            if (int.TryParse(windowSetting, out var w)) windowDays = w;

            var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";

            foreach (var user in users)
            {
                try
                {
                    // Use last digest time as cutoff to avoid resending the same articles
                    var since = user.LastDigestSentAt ?? DateTime.UtcNow.AddDays(-windowDays);

                    // Community: top articles that received likes since last digest
                    var communityItems = await db.Likes
                        .AsNoTracking()
                        .Where(l => l.CreatedAt >= since
                            && !l.FeedItem.IsCommunityHidden
                            && !l.FeedItem.Subscription.IsCommunityBanned
                            && !l.User.IsSiteBanned)
                        .GroupBy(l => l.FeedItemId)
                        .OrderByDescending(g => g.Count())
                        .Take(10)
                        .Select(g => new DigestItem(
                            g.First().FeedItem.Title,
                            g.First().FeedItem.Url,
                            g.First().FeedItem.Subscription.Title,
                            g.Count()))
                        .ToListAsync(ct);

                    // Personal feed: new articles from user's own subscriptions since last digest
                    var feedItems = await db.FeedItems
                        .AsNoTracking()
                        .Where(f => f.Subscription.UserId == user.Id
                            && f.FetchedAt >= since)
                        .OrderByDescending(f => f.PublishedAt)
                        .Take(10)
                        .Select(f => new DigestItem(
                            f.Title,
                            f.Url,
                            f.Subscription.Title,
                            0))
                        .ToListAsync(ct);

                    // Merge both sources, deduplicate by URL
                    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    var digestItems = communityItems.Concat(feedItems)
                        .Where(item => seen.Add(item.Url))
                        .ToList();

                    if (digestItems.Count == 0) continue;

                    await emailService.SendDailyDigestAsync(user.Email, baseUrl, digestItems, ct);

                    await db.Users
                        .Where(u => u.Id == user.Id)
                        .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastDigestSentAt, DateTime.UtcNow), ct);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to send daily digest to {Email}", user.Email);
                }
            }

            logger.LogInformation("Daily digest sent to {Count} user(s)", users.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "DailyDigestService failed");
        }
    }
}
