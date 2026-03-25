using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class RefreshToken
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("token_hash")]
    public required string TokenHash { get; set; }

    [Column("issued_at")]
    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("is_revoked")]
    public bool IsRevoked { get; set; } = false;

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }

    public User User { get; set; } = null!;
}
