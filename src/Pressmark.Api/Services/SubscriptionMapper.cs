namespace Pressmark.Api.Services;

/// <summary>
/// Projection from the subscription entity onto its protobuf message.
/// </summary>
/// <remarks>
/// The title the client sees is the user's own <c>DisplayName</c> when they set one,
/// falling back to the title the feed declared — resolved here so every endpoint
/// that returns a subscription agrees on which one wins.
/// </remarks>
internal static class SubscriptionMapper
{
    internal static Protos.Subscription ToProto(Entities.Subscription s) => new()
    {
        Id = s.Id.ToString(),
        UserId = s.UserId.ToString(),
        RssUrl = s.RssUrl,
        Title = s.DisplayName ?? s.Title,
        LastFetchedAt = s.LastFetchedAt?.ToString("o") ?? "",
        CreatedAt = s.CreatedAt.ToString("o"),
        IsCommunityBanned = s.IsCommunityBanned,
    };
}
