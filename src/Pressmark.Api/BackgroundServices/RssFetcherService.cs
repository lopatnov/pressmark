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

    /// <summary>
    /// Runs one fetch cycle over every subscription. Never throws: an unhandled
    /// exception out of <see cref="ExecuteAsync"/> stops the host, so a transient
    /// database error here would take the whole API down until it was restarted.
    /// </summary>
    private async Task FetchAllAsync(CancellationToken ct)
    {
        try
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
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    // One unreachable or malformed feed must not stop the rest of the cycle.
                    logger.LogWarning(ex, "Failed to fetch RSS for subscription {Id} ({Url})",
                        sub.Id, sub.RssUrl);
                }
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Shutting down; not an error.
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "RSS fetch cycle failed");
        }
    }
}
