using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class Comment
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("feed_item_id")]
    public Guid FeedItemId { get; set; }

    [Column("body")]
    public required string Body { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("removed_by_admin")]
    public bool RemovedByAdmin { get; set; }

    public User User { get; set; } = null!;
    public FeedItem FeedItem { get; set; } = null!;
}
