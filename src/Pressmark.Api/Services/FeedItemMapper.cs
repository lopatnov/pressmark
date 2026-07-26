namespace Pressmark.Api.Services;

/// <summary>
/// Maps feed item entities and broadcast events onto their protobuf representation.
/// Pure projection — no data access and no business rules.
/// </summary>
internal static class FeedItemMapper
{
    /// <summary>
    /// Projects a stored feed item, folding in the per-user read/like/bookmark state
    /// that the caller has already batch-loaded.
    /// </summary>
    internal static Protos.FeedItem ToProto(
        Entities.FeedItem item,
        HashSet<Guid> readIds,
        HashSet<Guid> likedIds,
        HashSet<Guid> bookmarkIds,
        Dictionary<Guid, int> likeCounts) => new()
        {
            Id = item.Id.ToString(),
            SubscriptionId = item.SubscriptionId.ToString(),
            Title = item.Title,
            Url = item.Url,
            Summary = item.Summary ?? "",
            PublishedAt = item.PublishedAt.ToString("o"),
            IsRead = readIds.Contains(item.Id),
            LikeCount = likeCounts.GetValueOrDefault(item.Id),
            IsLiked = likedIds.Contains(item.Id),
            IsBookmarked = bookmarkIds.Contains(item.Id),
            SourceTitle = item.Subscription?.Title ?? "",
            ImageUrl = item.ImageUrl ?? "",
            SourceRssUrl = item.Subscription?.RssUrl ?? "",
            IsSourceBanned = item.Subscription?.IsCommunityBanned ?? false,
        };

    /// <summary>
    /// Projects an item replayed to a reconnecting stream client.
    /// New items are never read/liked/bookmarked by definition.
    /// </summary>
    internal static Protos.FeedItem ToCatchUpProto(Entities.FeedItem item) =>
        ToProto(item, readIds: [], likedIds: [], bookmarkIds: [], likeCounts: []);

    /// <summary>Projects a live broadcast event pushed to streaming clients.</summary>
    internal static Protos.FeedItem ToBroadcastProto(FeedUpdateEvent evt) => new()
    {
        Id = evt.Id.ToString(),
        SubscriptionId = evt.SubscriptionId.ToString(),
        Title = evt.Title,
        Url = evt.Url,
        Summary = evt.Summary,
        PublishedAt = evt.PublishedAt.ToString("o"),
        IsRead = false,
        LikeCount = 0,
        IsLiked = false,
        IsBookmarked = false,
        SourceTitle = evt.SourceTitle,
        ImageUrl = evt.ImageUrl,
        IsSourceBanned = false, // streaming is pre-filtered to exclude banned sources
    };
}
