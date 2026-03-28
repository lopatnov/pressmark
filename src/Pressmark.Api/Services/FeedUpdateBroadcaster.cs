using System.Threading.Channels;

namespace Pressmark.Api.Services;

public record FeedUpdateEvent(
    Guid Id,
    Guid SubscriptionId,
    string Title,
    string Url,
    string Summary,
    DateTime PublishedAt,
    string ImageUrl,
    string SourceTitle
);

/// <summary>
/// Singleton broadcaster that fans out new feed items to all active streaming clients.
/// Each subscriber gets its own unbounded channel; the broadcaster writes to all of them.
/// </summary>
public class FeedUpdateBroadcaster
{
    private readonly List<ChannelWriter<FeedUpdateEvent>> _writers = [];
    private readonly object _lock = new();

    /// <summary>
    /// Registers a new streaming client. Returns the reader and the writer handle
    /// (needed to unsubscribe later).
    /// </summary>
    public (ChannelReader<FeedUpdateEvent> reader, ChannelWriter<FeedUpdateEvent> writer) Subscribe()
    {
        var channel = Channel.CreateBounded<FeedUpdateEvent>(
            new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
        lock (_lock)
        {
            _writers.Add(channel.Writer);
        }
        return (channel.Reader, channel.Writer);
    }

    /// <summary>Removes the writer so the client no longer receives broadcasts.</summary>
    public void Unsubscribe(ChannelWriter<FeedUpdateEvent> writer)
    {
        lock (_lock)
        {
            _writers.Remove(writer);
        }
        writer.TryComplete();
    }

    /// <summary>Writes the event to every active subscriber's channel.</summary>
    public Task BroadcastAsync(FeedUpdateEvent evt)
    {
        ChannelWriter<FeedUpdateEvent>[] snapshot;
        lock (_lock)
        {
            snapshot = [.. _writers];
        }
        foreach (var w in snapshot)
        {
            // TryWrite is non-blocking; if the bounded channel is full, DropOldest
            // evicts the oldest unread event rather than blocking the fetcher.
            w.TryWrite(evt);
        }
        return Task.CompletedTask;
    }
}
