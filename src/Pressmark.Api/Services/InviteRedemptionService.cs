using Grpc.Core;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Services;

/// <summary>
/// Validates and consumes invite tokens during invite-only registration.
/// </summary>
/// <remarks>
/// Validation and redemption are deliberately separate steps: the caller checks
/// the token is redeemable before creating the user, then redeems it afterwards,
/// both inside the serializable registration transaction that stops two
/// concurrent registrations from consuming the same token.
/// </remarks>
public class InviteRedemptionService(AppDbContext db)
{
    /// <summary>
    /// Throws <see cref="StatusCode.PermissionDenied"/> unless an unused,
    /// unexpired invite exists for the supplied token.
    /// </summary>
    public async Task EnsureRedeemableAsync(string token, CancellationToken ct)
    {
        var invite = await db.InviteTokens
            .FirstOrDefaultAsync(t =>
                t.Token == token &&
                !t.IsUsed &&
                (t.ExpiresAt == null || t.ExpiresAt > DateTime.UtcNow), ct);

        if (invite is null)
            throw new RpcException(new Status(StatusCode.PermissionDenied,
                "Invalid or expired invite token"));
    }

    /// <summary>
    /// Marks the invite as consumed by the new user and discards any other unused
    /// invites that were addressed to the same email.
    /// </summary>
    public async Task RedeemAsync(string token, User user, CancellationToken ct)
    {
        var invite = await db.InviteTokens.FirstAsync(t => t.Token == token, ct);
        invite.IsUsed = true;
        invite.UsedAt = DateTime.UtcNow;
        invite.UsedByUserId = user.Id;

        // Remove other unused tokens whose note matches the registered email
        if (!string.IsNullOrWhiteSpace(invite.Note) &&
            string.Equals(invite.Note, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var stale = await db.InviteTokens
                .Where(t => t.Note == invite.Note && !t.IsUsed && t.Id != invite.Id)
                .ToListAsync(ct);
            db.InviteTokens.RemoveRange(stale);
        }

        await db.SaveChangesAsync(ct);
    }
}
