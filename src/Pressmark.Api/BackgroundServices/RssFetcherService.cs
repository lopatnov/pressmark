using System.ServiceModel.Syndication;
using System.Xml;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;

namespace Pressmark.Api.BackgroundServices;

public class RssFetcherService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<RssFetcherService> logger) : BackgroundService
{
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(
        double.Parse(config["RssFetcher:IntervalMinutes"] ?? "15"));

    private readonly int _maxItems =
        int.Parse(config["RssFetcher:MaxItemsPerFeed"] ?? "50");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger first run by 10 s to let the app finish starting up
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await FetchAllAsync(stoppingToken);
            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task FetchAllAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var subscriptions = await db.Subscriptions.ToListAsync(ct);

        foreach (var sub in subscriptions)
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                await FetchSubscriptionAsync(db, sub, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to fetch RSS for subscription {Id} ({Url})",
                    sub.Id, sub.RssUrl);
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task FetchSubscriptionAsync(
        AppDbContext db, Entities.Subscription sub, CancellationToken ct)
    {
        SyndicationFeed feed;

        using var httpClient = new HttpClient();
        httpClient.Timeout = TimeSpan.FromSeconds(15);
        var xml = await httpClient.GetStringAsync(sub.RssUrl, ct);

        using var reader = XmlReader.Create(
            new StringReader(xml),
            new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore });
        feed = SyndicationFeed.Load(reader);

        var existingUrls = await db.FeedItems
            .Where(f => f.SubscriptionId == sub.Id)
            .Select(f => f.Url)
            .ToHashSetAsync(ct);

        var newItems = feed.Items
            .Take(_maxItems)
            .Where(i => i.Links.Count > 0)
            .Select(i => new
            {
                Url        = i.Links.First().Uri.ToString(),
                Title      = i.Title?.Text ?? "(no title)",
                Summary    = i.Summary?.Text,
                PublishedAt = i.PublishDate == DateTimeOffset.MinValue
                                ? DateTime.UtcNow
                                : i.PublishDate.UtcDateTime,
                ImageUrl   = ExtractImageUrl(i),
            })
            .Where(i => !existingUrls.Contains(i.Url))
            .ToList();

        foreach (var item in newItems)
        {
            db.FeedItems.Add(new FeedItem
            {
                SubscriptionId = sub.Id,
                Url            = item.Url,
                Title          = item.Title,
                Summary        = item.Summary,
                PublishedAt    = item.PublishedAt,
                ImageUrl       = item.ImageUrl,
            });
        }

        sub.LastFetchedAt = DateTime.UtcNow;

        if (newItems.Count > 0)
            logger.LogInformation("Fetched {Count} new items for subscription {Id}",
                newItems.Count, sub.Id);
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
