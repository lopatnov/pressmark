using System.Security.Cryptography;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Invite token administration: minting, listing and revoking invites used by
/// invite-only registration. See AdminServiceImpl.cs for the primary constructor.
/// </summary>
public partial class AdminServiceImpl
{
    public override async Task<Protos.InviteToken> GenerateInvite(
        GenerateInviteRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

        var entity = new Entities.InviteToken
        {
            Token = token,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            ExpiresAt = request.ExpiresDays > 0
                ? DateTime.UtcNow.AddDays(request.ExpiresDays)
                : (DateTime?)null,
        };

        db.InviteTokens.Add(entity);
        await db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(request.NotifyEmail))
        {
            try
            {
                await emailService.SendInviteAsync(request.NotifyEmail, token, ct);
            }
            catch (Exception ex)
            {
                // Non-fatal: log and continue; the token is still returned to the admin
                logger.LogWarning(ex, "Failed to send invite email to {Email}", request.NotifyEmail);
            }
        }

        // Returned once only — the list endpoint never exposes the raw token
        return AdminMapper.ToInviteToken(entity, token);
    }

    public override async Task<Empty> DeleteInvite(
        DeleteInviteRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var id = RpcGuards.ParseId(request.Id, "id");

        var entity = await db.InviteTokens.FindOrThrowAsync(id, "Invite not found", ct);

        db.InviteTokens.Remove(entity);
        await db.SaveChangesAsync(ct);

        return new Empty();
    }

    public override async Task<InviteList> ListInvites(
        ListInvitesRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var (page, pageSize) = AdminPaging.Normalize(request.Page, request.PageSize);

        var query = db.InviteTokens
            .Where(t => !t.IsUsed && (t.ExpiresAt == null || t.ExpiresAt > DateTime.UtcNow))
            .OrderByDescending(t => t.CreatedAt);

        var total = await query.CountAsync(ct);
        var invites = await query
            .ToPage(page, pageSize)
            .ToListAsync(ct);

        var result = new InviteList { TotalCount = total };
        result.Items.AddRange(invites.Select(t => AdminMapper.ToInviteToken(t, token: "")));
        return result;
    }
}
