using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class InviteToken
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("token")]
    public required string Token { get; set; }

    [Column("note")]
    public string? Note { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("is_used")]
    public bool IsUsed { get; set; } = false;

    [Column("used_at")]
    public DateTime? UsedAt { get; set; }

    [Column("used_by_user_id")]
    public Guid? UsedByUserId { get; set; }

    [Column("is_revoked")]
    public bool IsRevoked { get; set; } = false;

    [Column("revoked_at")]
    public DateTime? RevokedAt { get; set; }
}
