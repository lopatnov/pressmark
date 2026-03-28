using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class Report
{
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Column("reporter_user_id")]
    public Guid ReporterUserId { get; set; }

    /// <summary>"comment" or "subscription"</summary>
    [Column("type")]
    public string Type { get; set; } = "";

    [Column("target_id")]
    public Guid TargetId { get; set; }

    [Column("reason")]
    public string? Reason { get; set; }

    [Column("is_resolved")]
    public bool IsResolved { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Reporter { get; set; } = null!;
}
