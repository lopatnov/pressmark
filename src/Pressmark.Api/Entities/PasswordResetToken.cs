using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class PasswordResetToken
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("token_hash")]
    public required string TokenHash { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("is_used")]
    public bool IsUsed { get; set; } = false;

    [Column("used_at")]
    public DateTime? UsedAt { get; set; }

    public User User { get; set; } = null!;
}
