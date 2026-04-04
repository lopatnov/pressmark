using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class CommentSubscription
{
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("feed_item_id")]
    public Guid FeedItemId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public FeedItem FeedItem { get; set; } = null!;
}
