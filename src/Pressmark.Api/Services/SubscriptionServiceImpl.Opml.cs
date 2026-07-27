using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Bulk transfer of a user's subscriptions in OPML, the interchange format every
/// other feed reader speaks. See SubscriptionServiceImpl.cs for the primary constructor.
/// </summary>
public partial class SubscriptionServiceImpl
{
    public override async Task<ImportSubscriptionsResponse> ImportSubscriptions(
        ImportSubscriptionsRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
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
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var subs = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Title)
            .AsNoTracking()
            .ToListAsync(ct);

        return new ExportSubscriptionsResponse
        {
            OpmlContent = OpmlService.Generate(subs),
        };
    }
}
