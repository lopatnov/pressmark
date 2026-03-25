using System.Security.Cryptography;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

[Authorize(Roles = "Admin")]
public class AdminServiceImpl(AppDbContext db) : AdminService.AdminServiceBase
{
    public override async Task<SiteSettings> GetSiteSettings(Empty request, ServerCallContext context)
    {
        var ct       = context.CancellationToken;
        var settings = await db.SiteSettings.ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        return new SiteSettings
        {
            SiteName             = settings.GetValueOrDefault("site_name", "Pressmark"),
            CommunityWindowDays  = int.TryParse(settings.GetValueOrDefault("community_window_days"), out var d) ? d : 1,
            RegistrationMode     = settings.GetValueOrDefault("registration_mode", "open"),
        };
    }

    public override async Task<Empty> UpdateSiteSettings(UpdateSiteSettingsRequest request, ServerCallContext context)
    {
        var ct   = context.CancellationToken;
        var s    = request.Settings;

        await UpsertSetting("site_name",             s.SiteName, ct);
        await UpsertSetting("community_window_days", s.CommunityWindowDays.ToString(), ct);
        await UpsertSetting("registration_mode",     s.RegistrationMode, ct);

        return new Empty();
    }

    public override async Task<Empty> HideFeedItem(HideFeedItemRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.FeedItemId, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid feed_item_id"));

        var item = await db.FeedItems.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Feed item not found"));

        item.IsCommunityHidden = request.Hidden;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<Empty> BanSubscription(BanSubscriptionRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.SubscriptionId, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid subscription_id"));

        var sub = await db.Subscriptions.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Subscription not found"));

        sub.IsCommunityBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<UserList> ListUsers(Empty request, ServerCallContext context)
    {
        var ct    = context.CancellationToken;
        var users = await db.Users
            .OrderBy(u => u.CreatedAt)
            .Select(u => new UserInfo
            {
                Id        = u.Id.ToString(),
                Email     = u.Email,
                Role      = u.Role,
                CreatedAt = u.CreatedAt.ToString("O"),
            })
            .ToListAsync(ct);

        var result = new UserList();
        result.Users.AddRange(users);
        return result;
    }

    public override async Task<Protos.InviteToken> GenerateInvite(
        GenerateInviteRequest request, ServerCallContext context)
    {
        var ct    = context.CancellationToken;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

        var entity = new Entities.InviteToken
        {
            Token = token,
            Note  = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
        };

        db.InviteTokens.Add(entity);
        await db.SaveChangesAsync(ct);

        return new Protos.InviteToken
        {
            Id        = entity.Id.ToString(),
            Token     = token,   // returned once only
            Note      = entity.Note ?? "",
            CreatedAt = entity.CreatedAt.ToString("O"),
            IsUsed    = false,
            IsRevoked = false,
        };
    }

    public override async Task<Empty> RevokeInvite(
        RevokeInviteRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!Guid.TryParse(request.Id, out var id))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid id"));

        var entity = await db.InviteTokens.FindAsync([id], ct)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Invite not found"));

        entity.IsRevoked  = true;
        entity.RevokedAt  = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<InviteList> ListInvites(
        Empty request, ServerCallContext context)
    {
        var ct      = context.CancellationToken;
        var invites = await db.InviteTokens
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var result = new InviteList();
        result.Items.AddRange(invites.Select(t => new Protos.InviteToken
        {
            Id        = t.Id.ToString(),
            Token     = "",   // not exposed in list
            Note      = t.Note ?? "",
            CreatedAt = t.CreatedAt.ToString("O"),
            IsUsed    = t.IsUsed,
            UsedAt    = t.UsedAt?.ToString("O") ?? "",
            IsRevoked = t.IsRevoked,
        }));
        return result;
    }

    private async Task UpsertSetting(string key, string value, CancellationToken ct)
    {
        var setting = await db.SiteSettings.FindAsync([key], ct);
        if (setting is null)
            db.SiteSettings.Add(new Entities.SiteSetting { Key = key, Value = value });
        else
            setting.Value = value;

        await db.SaveChangesAsync(ct);
    }
}
