using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

public class AuthServiceImpl(AppDbContext db, JwtService jwt) : AuthService.AuthServiceBase
{
    public override async Task<AuthResponse> Register(
        RegisterRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var mode = await db.SiteSettings
            .Where(s => s.Key == "registration_mode")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct) ?? "open";

        if (mode == "invite_only")
        {
            if (string.IsNullOrWhiteSpace(request.InviteToken))
                throw new RpcException(new Status(StatusCode.PermissionDenied,
                    "An invite token is required"));

            var invite = await db.InviteTokens
                .FirstOrDefaultAsync(t =>
                    t.Token == request.InviteToken &&
                    !t.IsUsed &&
                    !t.IsRevoked, ct);

            if (invite is null)
                throw new RpcException(new Status(StatusCode.PermissionDenied,
                    "Invalid or expired invite token"));

            // Mark invite as used after user is created (below)
        }
        else if (mode != "open")
            throw new RpcException(new Status(StatusCode.FailedPrecondition,
                "Registration is closed"));

        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new RpcException(new Status(StatusCode.AlreadyExists,
                "Email already registered"));

        var isFirst = !await db.Users.AnyAsync(ct);

        var user = new User
        {
            Email        = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role         = isFirst ? "Admin" : "User",
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        if (mode == "invite_only")
        {
            var invite = await db.InviteTokens
                .FirstAsync(t => t.Token == request.InviteToken, ct);
            invite.IsUsed        = true;
            invite.UsedAt        = DateTime.UtcNow;
            invite.UsedByUserId  = user.Id;
            await db.SaveChangesAsync(ct);
        }

        return await IssueTokens(user, context.GetHttpContext(), ct);
    }

    public override async Task<AuthResponse> Login(
        LoginRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email, ct);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Invalid credentials"));

        return await IssueTokens(user, context.GetHttpContext(), ct);
    }

    public override async Task<AuthResponse> Refresh(
        RefreshRequest request, ServerCallContext context)
    {
        var ct   = context.CancellationToken;
        var http = context.GetHttpContext();
        var rawToken = http.Request.Cookies[jwt.CookieName];

        if (string.IsNullOrEmpty(rawToken))
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Missing refresh token"));

        var principal = jwt.ValidateRefreshToken(rawToken);
        if (principal is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Invalid or expired refresh token"));

        var tokenHash = JwtService.HashToken(rawToken);
        var stored = await db.RefreshTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                !t.IsRevoked &&
                t.ExpiresAt > DateTime.UtcNow, ct);

        if (stored is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Refresh token revoked or not found"));

        var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await db.Users.FindAsync([userId], ct);

        if (user is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated, "User not found"));

        // Revoke old token (rotation)
        stored.IsRevoked  = true;
        stored.RevokedAt  = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return await IssueTokens(user, http, ct);
    }

    public override async Task<Empty> Logout(Empty request, ServerCallContext context)
    {
        var ct       = context.CancellationToken;
        var http     = context.GetHttpContext();
        var rawToken = http.Request.Cookies[jwt.CookieName];

        if (!string.IsNullOrEmpty(rawToken))
        {
            var tokenHash = JwtService.HashToken(rawToken);
            var stored = await db.RefreshTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && !t.IsRevoked, ct);

            if (stored is not null)
            {
                stored.IsRevoked = true;
                stored.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
            }
        }

        http.Response.Cookies.Delete(jwt.CookieName);
        return new Empty();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<AuthResponse> IssueTokens(
        User user, HttpContext http, CancellationToken ct)
    {
        var accessToken  = jwt.GenerateAccessToken(user);
        var refreshToken = jwt.GenerateRefreshToken(user);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId    = user.Id,
            TokenHash = JwtService.HashToken(refreshToken),
            IssuedAt  = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(jwt.RefreshExpiryDays),
        });
        await db.SaveChangesAsync(ct);

        http.Response.Cookies.Append(jwt.CookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure   = http.Request.IsHttps,
            Expires  = DateTimeOffset.UtcNow.AddDays(jwt.RefreshExpiryDays),
        });

        return new AuthResponse
        {
            AccessToken = accessToken,
            Email       = user.Email,
            UserId      = user.Id.ToString(),
            Role        = user.Role,
        };
    }
}
