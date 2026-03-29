using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

public class CursorTests
{
    [Fact]
    public void RoundTrip_EncodeThenParse_ReturnsSameValues()
    {
        var date = new DateTime(2024, 6, 15, 10, 30, 0, DateTimeKind.Utc);
        var id = Guid.NewGuid();

        var cursor = CursorHelper.Encode(date, id);
        var ok = CursorHelper.TryParse(cursor, out var parsedDate, out var parsedId);

        Assert.True(ok);
        Assert.Equal(date, parsedDate);
        Assert.Equal(id, parsedId);
    }

    [Fact]
    public void TryParse_EmptyString_ReturnsFalse()
    {
        Assert.False(CursorHelper.TryParse("", out _, out _));
    }

    [Fact]
    public void TryParse_InvalidBase64_ReturnsFalse()
    {
        Assert.False(CursorHelper.TryParse("not-base64!!!", out _, out _));
    }

    [Fact]
    public void TryParse_MissingPipeSeparator_ReturnsFalse()
    {
        // Valid base64 but decoded content has no pipe
        var noPipe = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("12345678"));
        Assert.False(CursorHelper.TryParse(noPipe, out _, out _));
    }

    [Fact]
    public void TryParse_TooManyParts_ReturnsFalse()
    {
        var tooMany = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"123|{Guid.NewGuid()}|extra"));
        Assert.False(CursorHelper.TryParse(tooMany, out _, out _));
    }

    [Fact]
    public void TryParse_TicksOutOfRange_ReturnsFalse()
    {
        // long.MaxValue far exceeds DateTime.MaxValue.Ticks
        var outOfRange = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{long.MaxValue}|{Guid.NewGuid()}"));
        Assert.False(CursorHelper.TryParse(outOfRange, out _, out _));
    }

    [Fact]
    public void TryParse_InvalidGuid_ReturnsFalse()
    {
        var invalidGuid = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{DateTime.UtcNow.Ticks}|not-a-guid"));
        Assert.False(CursorHelper.TryParse(invalidGuid, out _, out _));
    }

    [Fact]
    public void TryParse_NegativeTicks_ReturnsFalse()
    {
        var negativeTicks = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"-1|{Guid.NewGuid()}"));
        // DateTime.MinValue.Ticks is 0, so -1 is below minimum
        Assert.False(CursorHelper.TryParse(negativeTicks, out _, out _));
    }

    [Fact]
    public void Encode_ProducesValidBase64()
    {
        var cursor = CursorHelper.Encode(DateTime.UtcNow, Guid.NewGuid());
        // Should not throw
        var bytes = Convert.FromBase64String(cursor);
        Assert.NotEmpty(bytes);
    }
}
