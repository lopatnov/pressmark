using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

public class CleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<CleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger first run so the app finishes starting up
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await CleanupAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }

    private async Task CleanupAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var result = await FeedRetentionCleaner.RunAsync(db, ct);

            if (result.RemovedAnything)
                logger.LogInformation(
                    "Cleanup: deleted {Likes} likes older than {Window}d, {Items} feed items older than {Retention}d",
                    result.DeletedLikes, result.WindowDays, result.DeletedItems, result.RetentionDays);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Cleanup failed");
        }
    }
}
