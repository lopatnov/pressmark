using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

/// <summary>Fetches every subscription on a fixed interval.</summary>
public class RssFetcherService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<RssFetcherService> logger,
    FeedFetcherService feedFetcher) : PeriodicBackgroundService(logger)
{
    // Stagger the first run by 10 s to let the app finish starting up.
    protected override TimeSpan InitialDelay => TimeSpan.FromSeconds(10);

    protected override TimeSpan Interval { get; } = TimeSpan.FromMinutes(
        double.Parse(config["RssFetcher:IntervalMinutes"] ?? "15"));

    protected override async Task RunCycleAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var subscriptions = await db.Subscriptions.ToListAsync(ct);

        foreach (var sub in subscriptions)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await feedFetcher.FetchAndSaveAsync(db, sub, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // One unreachable or malformed feed must not stop the rest of the cycle.
                Logger.LogWarning(ex, "Failed to fetch RSS for subscription {Id} ({Url})",
                    sub.Id, sub.RssUrl);
            }
        }
    }
}
