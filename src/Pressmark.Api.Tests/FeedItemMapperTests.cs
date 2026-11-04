using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// A live stream item has to carry the same "banned source" flag a loaded item does,
/// or the personal feed shows the badge on reload but not as the article arrives.
/// </summary>
public class FeedItemMapperTests
{
    private static FeedUpdateEvent MakeEvent(bool sourceBanned) => new(
        Guid.NewGuid(), Guid.NewGuid(), "Title", "https://example.com/a", "Summary",
        new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), "", "Source", sourceBanned);

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ToBroadcastProto_CarriesSourceBanFlag(bool sourceBanned)
    {
        var proto = FeedItemMapper.ToBroadcastProto(MakeEvent(sourceBanned));

        Assert.Equal(sourceBanned, proto.IsSourceBanned);
    }
}
