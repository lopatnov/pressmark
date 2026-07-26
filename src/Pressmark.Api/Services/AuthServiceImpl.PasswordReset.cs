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

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            TokenHash = tokenHash,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });
        await db.SaveChangesAsync(ct);

        var baseUrl = config["App:BaseUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{baseUrl.TrimEnd('/')}/reset-password?token={rawToken}";

        await emailService.SendPasswordResetAsync(user.Email, resetUrl, ct);

        return new Empty();
    }

    [AllowAnonymous]
    public override async Task<Empty> ResetPassword(
        ResetPasswordRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var tokenHash = JwtService.HashToken(request.Token);

        var record = await db.PasswordResetTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                !t.IsUsed &&
                t.ExpiresAt > DateTime.UtcNow, ct);

        if (record is null)
            throw new RpcException(new Status(StatusCode.NotFound,
                "Invalid or expired reset token"));

        var user = await db.Users.FindAsync([record.UserId], ct);
        if (user is null)
            throw new RpcException(new Status(StatusCode.NotFound, "User not found"));

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

        record.IsUsed = true;
        record.UsedAt = DateTime.UtcNow;

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
