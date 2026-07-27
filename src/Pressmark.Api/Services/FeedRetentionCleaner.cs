using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Services;

/// <summary>
/// Applies the site's retention settings: drops likes that have aged out of the
/// community window, then feed items past the retention period that nobody bookmarked.
/// </summary>
/// <remarks>
/// Shared by the nightly cleanup job and the admin's manual "clear old feeds" action,
/// which must agree on what counts as old — only their log lines differ, so the caller
/// reports the outcome rather than this helper.
/// </remarks>
internal static class FeedRetentionCleaner
{
    /// <summary>
    /// Feed items are deleted in batches: the id list is a single unbounded query
    /// result, and deleting it in one statement would hold locks over the whole table
    /// for as long as the pass takes.
    /// </summary>
    private const int DeleteBatchSize = 500;

    /// <summary>What a cleanup pass removed, and the settings it removed it under.</summary>
    internal readonly record struct Result(
        int DeletedLikes, int DeletedItems, int WindowDays, int RetentionDays)
    {
        /// <summary>True when the pass actually removed something worth logging.</summary>
        internal bool RemovedAnything => DeletedLikes > 0 || DeletedItems > 0;
    }

    internal static async Task<Result> RunAsync(AppDbContext db, CancellationToken ct)
    {
        var settings = await SiteSettingsSnapshot.LoadAsync(db, [
            SiteSettingKeys.CommunityWindowDays,
            SiteSettingKeys.FeedRetentionDays,
        ], ct);

        var windowDays = settings.CommunityWindowDays;
        var retentionDays = settings.FeedRetentionDays;

        // Likes older than the community window no longer influence the community feed
        var likeCutoff = DateTime.UtcNow.AddDays(-windowDays);
        var deletedLikes = await db.Likes
            .Where(l => l.CreatedAt < likeCutoff)
            .ExecuteDeleteAsync(ct);

        // Feed items past the retention period, unless someone bookmarked them
        var itemCutoff = DateTime.UtcNow.AddDays(-retentionDays);
        var expiredIds = await db.FeedItems
            .Where(f => f.FetchedAt < itemCutoff && !f.Bookmarks.Any())
            .Select(f => f.Id)
            .ToListAsync(ct);

        var deletedItems = 0;
        foreach (var batch in expiredIds.Chunk(DeleteBatchSize))
        {
            deletedItems += await db.FeedItems
                .Where(f => batch.Contains(f.Id))
                .ExecuteDeleteAsync(ct);
        }

        return new Result(deletedLikes, deletedItems, windowDays, retentionDays);
    }
}
