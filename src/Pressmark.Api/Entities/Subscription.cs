using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class Subscription
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("rss_url")]
    public required string RssUrl { get; set; }

    [Column("title")]
    public required string Title { get; set; }

    [Column("display_name")]
    public string? DisplayName { get; set; }

    [Column("last_fetched_at")]
    public DateTime? LastFetchedAt { get; set; }

    [Column("is_community_banned")]
    public bool IsCommunityBanned { get; set; } = false;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public ICollection<FeedItem> FeedItems { get; set; } = [];
}
