using Microsoft.EntityFrameworkCore;
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

            var settings = await SiteSettingsSnapshot.LoadAsync(db, [
                SiteSettingKeys.CommunityWindowDays,
                SiteSettingKeys.FeedRetentionDays,
            ], ct);

            var windowDays = settings.CommunityWindowDays;
            var retentionDays = settings.FeedRetentionDays;

            // Delete likes older than community window
            var likeCutoff = DateTime.UtcNow.AddDays(-windowDays);
            var deletedLikes = await db.Likes
                .Where(l => l.CreatedAt < likeCutoff)
                .ExecuteDeleteAsync(ct);

            // Delete feed items older than retention period that have no bookmark
            var itemCutoff = DateTime.UtcNow.AddDays(-retentionDays);
            var toDelete = await db.FeedItems
                .Where(f => f.FetchedAt < itemCutoff && !f.Bookmarks.Any())
                .Select(f => f.Id)
                .ToListAsync(ct);

            var deletedItems = 0;
            foreach (var batch in toDelete.Chunk(500))
            {
                deletedItems += await db.FeedItems
                    .Where(f => batch.Contains(f.Id))
                    .ExecuteDeleteAsync(ct);
            }

            if (deletedLikes > 0 || deletedItems > 0)
                logger.LogInformation(
                    "Cleanup: deleted {Likes} likes older than {Window}d, {Items} feed items older than {Retention}d",
                    deletedLikes, windowDays, deletedItems, retentionDays);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Cleanup failed");
        }
    }
}
