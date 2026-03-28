using System.Security.Claims;
using System.ServiceModel.Syndication;
using System.Xml;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

[Authorize]
public class SubscriptionServiceImpl(AppDbContext db, IHttpClientFactory httpClientFactory, FeedFetcherService feedFetcher) : SubscriptionService.SubscriptionServiceBase
{
    public override async Task<Protos.Subscription> AddSubscription(
        AddSubscriptionRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        if (!Uri.TryCreate(request.RssUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid RSS URL"));

        // Validate by fetching and parsing the feed; also use the feed title as default
        var feedTitle = "";
        try
        {
            var http = httpClientFactory.CreateClient("Pressmark");
            http.Timeout = TimeSpan.FromSeconds(10);
            var bytes = await http.GetByteArrayAsync(request.RssUrl, ct);
            var xml = LenientUtf8.GetString(bytes);

            using var reader = XmlReader.Create(
                new StringReader(xml),
                new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore, CheckCharacters = false });
            feedTitle = SyndicationFeed.Load(reader).Title?.Text ?? "";
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "Could not fetch RSS feed: the URL is unreachable or returned an error"));
        }
        catch (Exception)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument,
                "Could not parse RSS feed: the URL does not appear to be a valid RSS/Atom feed"));
        }

        var existing = await db.Subscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.RssUrl == request.RssUrl, ct);
        if (existing != null)
            return ToProto(existing);

        var entity = new Entities.Subscription
        {
            UserId = userId,
            RssUrl = request.RssUrl,
            Title = string.IsNullOrWhiteSpace(request.Title)
                        ? (string.IsNullOrWhiteSpace(feedTitle) ? request.RssUrl : feedTitle)
                        : request.Title,
        };

        db.Subscriptions.Add(entity);
        await db.SaveChangesAsync(ct);

        return ToProto(entity);
    }

    public override async Task<Empty> RemoveSubscription(
        RemoveSubscriptionRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.SubscriptionId, out var subId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid subscription_id"));

        var sub = await db.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subId && s.UserId == userId, ct);

        if (sub is null)
            throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));

        db.Subscriptions.Remove(sub);
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<SubscriptionList> ListSubscriptions(
        Empty request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        var subs = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Title)
            .ToListAsync(ct);

        var list = new SubscriptionList();
        list.Subscriptions.AddRange(subs.Select(ToProto));
        return list;
    }

    public override async Task<ImportSubscriptionsResponse> ImportSubscriptions(
        ImportSubscriptionsRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        List<(string RssUrl, string Title)> entries;
        try
        {
            entries = OpmlService.Parse(request.OpmlContent);
        }
        catch
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid OPML content"));
        }

        var existingUrls = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .Select(s => s.RssUrl)
            .ToHashSetAsync(ct);

        int imported = 0, skipped = 0;
        foreach (var (rssUrl, title) in entries)
        {
            if (existingUrls.Contains(rssUrl)) { skipped++; continue; }

            db.Subscriptions.Add(new Entities.Subscription
            {
                UserId = userId,
                RssUrl = rssUrl,
                Title = title,
            });
            existingUrls.Add(rssUrl);
            imported++;
        }

        if (imported > 0)
            await db.SaveChangesAsync(ct);

        return new ImportSubscriptionsResponse { Imported = imported, Skipped = skipped };
    }

    public override async Task<ExportSubscriptionsResponse> ExportSubscriptions(
        Empty request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        var subs = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Title)
            .ToListAsync(ct);

        return new ExportSubscriptionsResponse
        {
            OpmlContent = OpmlService.Generate(subs),
        };
    }

    public override async Task<TriggerFetchResponse> TriggerFetch(
        TriggerFetchRequest request, ServerCallContext context)
    {
        var userId = GetUserId(context);
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.SubscriptionId, out var subId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid subscription ID"));

        var sub = await db.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subId && s.UserId == userId, ct);

        if (sub is null)
            throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));

        var newItems = await feedFetcher.FetchAndSaveAsync(db, sub, ct);
        return new TriggerFetchResponse { NewItems = newItems };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static Guid GetUserId(ServerCallContext context)
    {
        var claim = context.GetHttpContext()
            .User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (claim is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated, "Not authenticated"));

        return Guid.Parse(claim);
    }

    private static Protos.Subscription ToProto(Entities.Subscription s) => new()
    {
        Id = s.Id.ToString(),
        UserId = s.UserId.ToString(),
        RssUrl = s.RssUrl,
        Title = s.Title,
        LastFetchedAt = s.LastFetchedAt?.ToString("o") ?? "",
        CreatedAt = s.CreatedAt.ToString("o"),
    };
}
