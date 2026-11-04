using Microsoft.EntityFrameworkCore;

namespace Pressmark.Api.Services;

/// <summary>
/// Keyset-pagination building blocks shared by every feed listing endpoint
/// (personal feed, bookmarks and the community feed), which all page over
/// feed items ordered by newest-first with a "publishedAt|id" cursor.
/// </summary>
internal static class FeedQueryExtensions
{
    /// <summary>Normalises a client-supplied page size to the supported range.</summary>
    internal static int ClampPageSize(int requested) =>
        Math.Clamp(requested == 0 ? PagingDefaults.DefaultPageSize : requested, 1, PagingDefaults.MaxPageSize);

    /// <summary>
    /// Restricts the query to items strictly older than the cursor position.
    /// An absent or unparsable cursor leaves the query untouched (first page).
    /// </summary>
    internal static IQueryable<Entities.FeedItem> ApplyCursor(
        this IQueryable<Entities.FeedItem> query, string cursor)
    {
        if (string.IsNullOrEmpty(cursor)
            || !CursorHelper.TryParse(cursor, out var cursorDate, out var cursorId))
            return query;

        return query.Where(f =>
            f.PublishedAt < cursorDate ||
            (f.PublishedAt == cursorDate && f.Id.CompareTo(cursorId) < 0));
    }

    /// <summary>
    /// Restricts the query to items the caller may open as a single article.
    /// Community moderation (a hidden item, a banned source) only takes an item off
    /// the shared surfaces: an admin still sees it in order to review it, and the
    /// subscription's owner still sees it, because it stays in their personal feed
    /// and that feed links to the article page.
    /// </summary>
    /// <param name="userId">The caller, or <c>null</c> when anonymous.</param>
    internal static IQueryable<Entities.FeedItem> WhereViewableBy(
        this IQueryable<Entities.FeedItem> query, Guid? userId, bool isAdmin)
    {
        if (isAdmin) return query;

        return query.Where(f =>
            (!f.IsCommunityHidden && !f.Subscription.IsCommunityBanned)
            || f.Subscription.UserId == userId);
    }

    /// <summary>
    /// The replay a reconnecting stream client gets: the newest <paramref name="maxItems"/>
    /// of the caller's own items published after <paramref name="since"/>, newest-first.
    /// Like the personal feed it extends, it ignores community moderation.
    /// </summary>
    internal static IQueryable<Entities.FeedItem> CatchUpSince(
        this IQueryable<Entities.FeedItem> query, Guid userId, DateTime since, int maxItems) =>
        query
            .Where(f => f.Subscription.UserId == userId && f.PublishedAt > since)
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(maxItems);

    /// <summary>
    /// Fetches one page newest-first, reading one extra row to detect whether
    /// further pages exist without issuing a second count query.
    /// </summary>
    internal static async Task<(List<Entities.FeedItem> Items, bool HasMore)> ToPageAsync(
        this IQueryable<Entities.FeedItem> query, int pageSize, CancellationToken ct)
    {
        var items = await query
            .OrderByDescending(f => f.PublishedAt)
            .ThenByDescending(f => f.Id)
            .Take(pageSize + 1)
            .ToListAsync(ct);

        var hasMore = items.Count > pageSize;
        return (items.Take(pageSize).ToList(), hasMore);
    }

    /// <summary>
    /// Encodes the cursor pointing at the item after the supplied page,
    /// or an empty string when the page is the last one.
    /// </summary>
    internal static string NextCursor(List<Entities.FeedItem> pageItems, bool hasMore)
    {
        if (!hasMore) return "";

        var last = pageItems[^1];
        return CursorHelper.Encode(last.PublishedAt, last.Id);
    }
}
