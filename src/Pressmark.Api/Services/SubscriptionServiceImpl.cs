using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// A user's own RSS sources: adding, renaming, removing and listing them, plus the
/// on-demand refresh and the daily-digest opt-in.
/// </summary>
/// <remarks>
/// Split across partial files by sub-domain:
/// <list type="bullet">
/// <item>SubscriptionServiceImpl.cs — the sources themselves (this file)</item>
/// <item>SubscriptionServiceImpl.Opml.cs — OPML import and export</item>
/// </list>
/// Fetching and parsing feeds belongs to <see cref="FeedFetcherService"/> and projection
/// to <see cref="SubscriptionMapper"/>; every endpoint here is scoped to the caller's own
/// rows, so a subscription belonging to someone else reads as missing rather than denied.
/// </remarks>
[Authorize]
public partial class SubscriptionServiceImpl(
    AppDbContext db, FeedFetcherService feedFetcher) : SubscriptionService.SubscriptionServiceBase
{
    public override async Task<Protos.Subscription> AddSubscription(
        AddSubscriptionRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        if (!Uri.TryCreate(request.RssUrl, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid RSS URL"));

        // Validate by fetching and parsing the feed; also use the feed title as default
        string feedTitle;
        try
        {
            feedTitle = await feedFetcher.ReadFeedTitleAsync(request.RssUrl, ct);
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
            return SubscriptionMapper.ToProto(existing);

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

        return SubscriptionMapper.ToProto(entity);
    }

    public override async Task<Protos.Subscription> UpdateSubscription(
        UpdateSubscriptionRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var sub = await FindOwnSubscriptionAsync(request.SubscriptionId, userId, ct);

        sub.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        await db.SaveChangesAsync(ct);

        return SubscriptionMapper.ToProto(sub);
    }

    public override async Task<Empty> RemoveSubscription(
        RemoveSubscriptionRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var sub = await FindOwnSubscriptionAsync(request.SubscriptionId, userId, ct);

        db.Subscriptions.Remove(sub);
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<SubscriptionList> ListSubscriptions(
        Empty request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var subs = await db.Subscriptions
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.DisplayName ?? s.Title)
            .AsNoTracking()
            .ToListAsync(ct);

        var digestEnabled = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => u.DigestEnabled)
            .FirstOrDefaultAsync(ct);

        var list = new SubscriptionList { DigestEnabled = digestEnabled };
        list.Subscriptions.AddRange(subs.Select(SubscriptionMapper.ToProto));
        return list;
    }

    public override async Task<ToggleDigestSubscriptionResponse> ToggleDigestSubscription(
        Empty request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var user = await db.Users.FindOrThrowAsync(userId, "User not found", ct);

        user.DigestEnabled = !user.DigestEnabled;
        await db.SaveChangesAsync(ct);

        return new ToggleDigestSubscriptionResponse { Enabled = user.DigestEnabled };
    }

    public override async Task<TriggerFetchResponse> TriggerFetch(
        TriggerFetchRequest request, ServerCallContext context)
    {
        var userId = context.GetUserId();
        var ct = context.CancellationToken;

        var sub = await FindOwnSubscriptionAsync(request.SubscriptionId, userId, ct);

        var newItems = await feedFetcher.FetchAndSaveAsync(db, sub, ct);
        return new TriggerFetchResponse { NewItems = newItems };
    }

    /// <summary>
    /// Loads a subscription the caller owns, or reports <see cref="StatusCode.NotFound"/>.
    /// </summary>
    /// <remarks>
    /// Ownership is part of the lookup rather than a separate check, so someone else's
    /// subscription is indistinguishable from one that does not exist and the id space
    /// cannot be probed.
    /// </remarks>
    private async Task<Entities.Subscription> FindOwnSubscriptionAsync(
        string subscriptionId, Guid userId, CancellationToken ct)
    {
        var subId = RpcGuards.ParseId(subscriptionId, "subscription_id");

        return await db.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subId && s.UserId == userId, ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));
    }
}
