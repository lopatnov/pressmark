using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class FeedItem
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("subscription_id")]
    public Guid SubscriptionId { get; set; }

    [Column("title")]
    public required string Title { get; set; }

    [Column("url")]
    public required string Url { get; set; }

    [Column("summary")]
    public string? Summary { get; set; }

    [Column("image_url")]
    public string? ImageUrl { get; set; }

    [Column("published_at")]
    public DateTime PublishedAt { get; set; }

    [Column("fetched_at")]
    public DateTime FetchedAt { get; set; } = DateTime.UtcNow;

    [Column("is_community_hidden")]
    public bool IsCommunityHidden { get; set; } = false;

    public Subscription Subscription { get; set; } = null!;
    public ICollection<ReadItem> ReadItems { get; set; } = [];
    public ICollection<Like> Likes { get; set; } = [];
    public ICollection<Bookmark> Bookmarks { get; set; } = [];
}
