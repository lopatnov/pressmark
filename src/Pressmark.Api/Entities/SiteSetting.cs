using System.ComponentModel.DataAnnotations.Schema;

namespace Pressmark.Api.Entities;

public class SiteSetting
{
    [Column("key")]
    public required string Key { get; set; }

    [Column("value")]
    public required string Value { get; set; }
}
