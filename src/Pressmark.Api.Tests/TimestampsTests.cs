using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// Regression coverage for the UTC timestamp bug: SQL Server's datetime2 carries no
/// zone, so EF Core hands a stored value back as DateTimeKind.Unspecified, and the
/// "O" format specifier then omits the trailing Z on that value while keeping it on
/// an otherwise-identical DateTimeKind.Utc value (e.g. one pushed straight from a
/// DateTime.UtcNow over the update stream) — the same instant serialised two
/// different ways depending only on where it came from. ToIsoUtc pins the kind
/// before formatting so both agree.
/// </summary>
public class TimestampsTests
{
    private static readonly DateTime Instant = new(2024, 6, 15, 10, 30, 0, 0);

    [Fact]
    public void ToIsoUtc_UnspecifiedKind_EndsWithZ()
    {
        var value = DateTime.SpecifyKind(Instant, DateTimeKind.Unspecified);

        Assert.EndsWith("Z", value.ToIsoUtc());
    }

    [Fact]
    public void ToIsoUtc_UtcKind_EndsWithZ()
    {
        var value = DateTime.SpecifyKind(Instant, DateTimeKind.Utc);

        Assert.EndsWith("Z", value.ToIsoUtc());
    }

    /// <summary>
    /// This is the actual bug: before the fix, DateTime.ToString("O") kept the Z for
    /// a DateTimeKind.Utc value but dropped it for an otherwise-identical
    /// DateTimeKind.Unspecified value — the same stored instant rendering
    /// differently (shifted by the viewer's local offset) depending only on whether
    /// EF Core or the update stream produced the value.
    /// </summary>
    [Fact]
    public void ToIsoUtc_SameInstant_UnspecifiedAndUtcKindProduceTheSameWireFormat()
    {
        var unspecified = DateTime.SpecifyKind(Instant, DateTimeKind.Unspecified);
        var utc = DateTime.SpecifyKind(Instant, DateTimeKind.Utc);

        Assert.Equal(utc.ToIsoUtc(), unspecified.ToIsoUtc());
    }

    [Fact]
    public void ToIsoUtc_Nullable_Null_ReturnsEmptyString()
    {
        DateTime? value = null;

        Assert.Equal("", value.ToIsoUtc());
    }

    [Fact]
    public void ToIsoUtc_Nullable_Value_MatchesTheNonNullableOverload()
    {
        var value = DateTime.SpecifyKind(Instant, DateTimeKind.Unspecified);
        DateTime? nullable = value;

        Assert.Equal(value.ToIsoUtc(), nullable.ToIsoUtc());
    }
}
