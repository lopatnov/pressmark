using System.ServiceModel.Syndication;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Services;

/// <summary>
/// Encapsulates the RSS fetch-and-persist logic so it can be called by both
/// the background scheduler (RssFetcherService) and on-demand via TriggerFetch.
/// </summary>
public class FeedFetcherService(
    IHttpClientFactory httpClientFactory,
    FeedUpdateBroadcaster broadcaster,
    IConfiguration config,
    ILogger<FeedFetcherService> logger)
{
    private readonly int _maxItems =
        int.Parse(config["RssFetcher:MaxItemsPerFeed"] ?? "50");

    /// <summary>
    /// Fetches a single RSS subscription, saves new items to the database,
    /// broadcasts them to streaming clients, and returns the count of new items.
    /// The caller is responsible for calling SaveChangesAsync if needed — this
    /// method calls SaveChangesAsync internally.
    /// </summary>
    public async Task<int> FetchAndSaveAsync(
        AppDbContext db, Subscription sub, CancellationToken ct)
    {
        var httpClient = httpClientFactory.CreateClient("Pressmark");
        httpClient.Timeout = TimeSpan.FromSeconds(15);
        var bytes = await httpClient.GetByteArrayAsync(sub.RssUrl, ct);
        var xml = LenientUtf8.GetString(bytes);

        SyndicationFeed feed;
        using (var reader = XmlReader.Create(
            new StringReader(xml),
            new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore, CheckCharacters = false }))
        {
            feed = SyndicationFeed.Load(reader);
        }

        var existingUrls = await db.FeedItems
            .Where(f => f.SubscriptionId == sub.Id)
            .Select(f => f.Url)
            .ToHashSetAsync(ct);

        var newItems = feed.Items
            .Take(_maxItems)
            .Where(i => i.Links.Count > 0)
            .Select(i => new
            {
                Url = i.Links.First().Uri.ToString(),
                Title = i.Title?.Text ?? "(no title)",
                Summary = string.IsNullOrWhiteSpace(i.Summary?.Text) ? null : i.Summary.Text.Trim(),
                PublishedAt = i.PublishDate == DateTimeOffset.MinValue
                                ? DateTime.UtcNow
                                : i.PublishDate.UtcDateTime,
                ImageUrl = ExtractImageUrl(i),
            })
            .Where(i => !existingUrls.Contains(i.Url))
            .ToList();

        var addedItems = new List<FeedItem>();

        foreach (var item in newItems)
        {
            var feedItem = new FeedItem
            {
                SubscriptionId = sub.Id,
                Url = item.Url,
                Title = item.Title,
                Summary = item.Summary,
                PublishedAt = item.PublishedAt,
                ImageUrl = item.ImageUrl,
            };
            db.FeedItems.Add(feedItem);
            addedItems.Add(feedItem);
        }

        sub.LastFetchedAt = DateTime.UtcNow;

        if (newItems.Count > 0)
            logger.LogInformation("Fetched {Count} new items for subscription {Id}",
                newItems.Count, sub.Id);

        // Enrich items without an RSS image by fetching og:image from the article page
        var needOg = addedItems
            .Where(i => i.ImageUrl == null && i.Url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (needOg.Count > 0)
        {
            var ogTasks = needOg.Select(i => TryFetchOgImageAsync(httpClient, i.Url, ct));
            var ogImages = await Task.WhenAll(ogTasks);
            for (var i = 0; i < needOg.Count; i++)
                needOg[i].ImageUrl = ogImages[i];
        }

        await db.SaveChangesAsync(ct);

        // Broadcast newly saved items (IDs are set after SaveChanges)
        foreach (var item in addedItems)
        {
            await broadcaster.BroadcastAsync(new FeedUpdateEvent(
                item.Id, item.SubscriptionId, item.Title, item.Url,
                item.Summary ?? "", item.PublishedAt, item.ImageUrl ?? "", sub.Title));
        }

        return addedItems.Count;
    }


    private static async Task<string?> TryFetchOgImageAsync(
        HttpClient client, string url, CancellationToken ct)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(5));

            var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (contentType?.StartsWith("text/html", StringComparison.OrdinalIgnoreCase) != true)
                return null;

            // Read only first 64 KB — og:image is always in <head>
            var stream = await response.Content.ReadAsStreamAsync(cts.Token);
            var buffer = new byte[65_536];
            var bytesRead = await stream.ReadAsync(buffer, cts.Token);
            var html = Encoding.UTF8.GetString(buffer, 0, bytesRead);

            // Try both attribute orders: property first, then content first
            var match = Regex.Match(html,
                @"<meta[^>]+property=[""']og:image[""'][^>]+content=[""']([^""'<>]+)[""']",
                RegexOptions.IgnoreCase);
            if (!match.Success)
                match = Regex.Match(html,
                    @"<meta[^>]+content=[""']([^""'<>]+)[""'][^>]+property=[""']og:image[""']",
                    RegexOptions.IgnoreCase);

            return match.Success ? match.Groups[1].Value.Trim() : null;
        }
        catch
        {
            return null; // timeout, 404, non-HTML — silently skip
        }
    }

    private static string? ExtractImageUrl(SyndicationItem item)
    {
        // 1. <enclosure> link
        var enclosure = item.Links
            .FirstOrDefault(l => l.RelationshipType == "enclosure"
                              && l.MediaType?.StartsWith("image/") == true);
        if (enclosure != null) return enclosure.Uri.ToString();

        // 2. <media:content> or <media:thumbnail> extensions
        foreach (var ext in item.ElementExtensions)
        {
            if (ext.OuterNamespace != "http://search.yahoo.com/mrss/") continue;
            if (ext.OuterName is not ("content" or "thumbnail")) continue;

            var el = ext.GetObject<System.Xml.Linq.XElement>();
            var url = el.Attribute("url")?.Value;
            if (!string.IsNullOrEmpty(url)) return url;
        }

        return null;
    }
}
