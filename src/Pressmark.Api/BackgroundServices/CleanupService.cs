using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

/// <summary>Applies the retention settings once a day; see <see cref="FeedRetentionCleaner"/>.</summary>
public class CleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<CleanupService> logger) : PeriodicBackgroundService(logger)
{
    // Stagger the first run so the app finishes starting up.
    protected override TimeSpan InitialDelay => TimeSpan.FromSeconds(30);

    protected override TimeSpan Interval => TimeSpan.FromHours(24);

    protected override async Task RunCycleAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var result = await FeedRetentionCleaner.RunAsync(db, ct);

        if (result.RemovedAnything)
            Logger.LogInformation(
                "Cleanup: deleted {Likes} likes older than {Window}d, {Items} feed items older than {Retention}d",
                result.DeletedLikes, result.WindowDays, result.DeletedItems, result.RetentionDays);
    }
}
