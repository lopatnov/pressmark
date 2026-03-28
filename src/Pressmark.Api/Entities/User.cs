using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class User
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("email")]
    public required string Email { get; set; }

    [Column("password_hash")]
    public required string PasswordHash { get; set; }

    [Column("role")]
    public string Role { get; set; } = "User";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("is_commenting_banned")]
    public bool IsCommentingBanned { get; set; }

    public ICollection<Subscription> Subscriptions { get; set; } = [];
    public ICollection<ReadItem> ReadItems { get; set; } = [];
    public ICollection<Like> Likes { get; set; } = [];
    public ICollection<Bookmark> Bookmarks { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}
