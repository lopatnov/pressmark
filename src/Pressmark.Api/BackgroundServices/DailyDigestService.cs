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

            // Users with digest enabled who haven't received one yet today
            var users = await db.Users
                .AsNoTracking()
                .Where(u => u.DigestEnabled
                    && !u.IsSiteBanned
                    && (u.LastDigestSentAt == null || u.LastDigestSentAt < todayUtc))
                .Select(u => new { u.Id, u.Email })
                .ToListAsync(ct);

            if (users.Count == 0) return;

            var windowDays = 1;
            var windowSetting = await db.SiteSettings
                .Where(s => s.Key == "community_window_days")
                .Select(s => s.Value)
                .FirstOrDefaultAsync(ct);
            if (int.TryParse(windowSetting, out var w)) windowDays = w;

            var since = DateTime.UtcNow.AddDays(-windowDays);
            var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";

            // Top 20 articles liked by the community in the window (same query as community feed)
            var topItems = await db.Likes
                .AsNoTracking()
                .Where(l => l.CreatedAt >= since
                    && !l.FeedItem.IsCommunityHidden
                    && !l.FeedItem.Subscription.IsCommunityBanned
                    && !l.User.IsSiteBanned)
                .GroupBy(l => l.FeedItemId)
                .OrderByDescending(g => g.Count())
                .Take(20)
                .Select(g => new
                {
                    FeedItemId = g.Key,
                    LikeCount = g.Count(),
                    Title = g.First().FeedItem.Title,
                    Url = g.First().FeedItem.Url,
                    SourceTitle = g.First().FeedItem.Subscription.Title,
                })
                .ToListAsync(ct);

            if (topItems.Count == 0) return;

            var digestItems = topItems
                .Select(x => new DigestItem(x.Title, x.Url, x.SourceTitle, x.LikeCount))
                .ToList();

            foreach (var user in users)
            {
                try
                {
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
