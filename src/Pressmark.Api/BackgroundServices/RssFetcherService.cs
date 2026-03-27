using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

public class RssFetcherService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<RssFetcherService> logger,
    FeedFetcherService feedFetcher) : BackgroundService
{
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(
        double.Parse(config["RssFetcher:IntervalMinutes"] ?? "15"));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger first run by 10 s to let the app finish starting up
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await FetchAllAsync(stoppingToken);
            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task FetchAllAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var subscriptions = await db.Subscriptions.ToListAsync(ct);

        foreach (var sub in subscriptions)
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                await feedFetcher.FetchAndSaveAsync(db, sub, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to fetch RSS for subscription {Id} ({Url})",
                    sub.Id, sub.RssUrl);
            }
        }
    }
}
