using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class ReadItem
{
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("feed_item_id")]
    public Guid FeedItemId { get; set; }

    [Column("read_at")]
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public FeedItem FeedItem { get; set; } = null!;
}
