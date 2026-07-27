using System.Data;
using System.Security.Cryptography;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Password reset by emailed single-use token.
/// See AuthServiceImpl.cs for the primary constructor.
/// </summary>
public partial class AuthServiceImpl
{
    [AllowAnonymous]
    public override async Task<Empty> ForgotPassword(
        ForgotPasswordRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        // Always return success — don't reveal whether the email exists
        if (user is null) return new Empty();

        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
        var tokenHash = JwtService.HashToken(rawToken);

        // Single outstanding token per user: burn any still-live ones so a reset link
        // from an earlier request cannot be used once a newer one has been issued.
        // Serializable so two concurrent requests can't both see "nothing to burn"
        // and each insert a token, leaving two simultaneously live.
        await using (var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct))
        {
            await db.PasswordResetTokens
                .Where(t => t.UserId == user.Id && !t.IsUsed)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.IsUsed, true)
                    .SetProperty(t => t.UsedAt, DateTime.UtcNow), ct);

            db.PasswordResetTokens.Add(new PasswordResetToken
            {
                TokenHash = tokenHash,
                UserId = user.Id,
                ExpiresAt = DateTime.UtcNow.AddHours(1),
            });
            await db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);
        }

        var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{baseUrl.TrimEnd('/')}/reset-password?token={rawToken}";

        try
        {
            await emailService.SendPasswordResetAsync(user.Email, resetUrl, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Non-fatal, and deliberately not reported: a delivery failure is only
            // reachable for an address that exists, so surfacing it would undo the
            // unconditional success above and turn this into an account-existence
            // oracle. Logs the user id, not the address, to keep PII out of logs.
            logger.LogWarning(ex, "Failed to send password reset email for user {UserId}", user.Id);
        }

        return new Empty();
    }

    [AllowAnonymous]
    public override async Task<Empty> ResetPassword(
        ResetPasswordRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        // Same policy as Register — a reset must not be a way around it.
        if (request.NewPassword.Length < 8)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Password must be at least 8 characters"));

        var tokenHash = JwtService.HashToken(request.Token);
        var now = DateTime.UtcNow;

        // Claim the token atomically: two concurrent requests presenting the same
        // token can both load it as unused before either writes, so the actual
        // single-use guarantee has to come from this conditional update's affected
        // row count, not from the preceding read.
        var claimed = await db.PasswordResetTokens
            .Where(t => t.TokenHash == tokenHash && !t.IsUsed && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsUsed, true)
                .SetProperty(t => t.UsedAt, now), ct);

        if (claimed == 0)
            throw new RpcException(new Status(StatusCode.NotFound,
                "Invalid or expired reset token"));

        var record = await db.PasswordResetTokens
            .AsNoTracking()
            .FirstAsync(t => t.TokenHash == tokenHash, ct);

        var user = await db.Users.FindAsync([record.UserId], ct);
        if (user is null)
            throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        // Revoke all active refresh tokens — force re-login with new password
        var activeTokens = await db.RefreshTokens
            .Where(t => t.UserId == user.Id && !t.IsRevoked)
            .ToListAsync(ct);
        foreach (var t in activeTokens)
        {
            t.IsRevoked = true;
            t.RevokedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return new Empty();
    }
}
