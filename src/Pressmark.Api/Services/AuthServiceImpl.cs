using System.Security.Claims;
using System.Security.Cryptography;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

public class AuthServiceImpl(
    AppDbContext db, JwtService jwt,
    IEmailService emailService, IConfiguration config) : AuthService.AuthServiceBase
{
    public override async Task<AuthResponse> Register(
        RegisterRequest request, ServerCallContext context)
    {
        var ct = context.CancellationToken;

        if (!System.Net.Mail.MailAddress.TryCreate(request.Email, out _))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid email address"));
        if (request.Password.Length < 8)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Password must be at least 8 characters"));

        var mode = await db.SiteSettings
            .Where(s => s.Key == "registration_mode")
            .Select(s => s.Value)
            .FirstOrDefaultAsync(ct) ?? "open";

        if (mode == "invite_only")
        {
            if (string.IsNullOrWhiteSpace(request.InviteToken))
                throw new RpcException(new Status(StatusCode.PermissionDenied,
                    "An invite token is required"));
        }
        else if (mode != "open")
            throw new RpcException(new Status(StatusCode.FailedPrecondition,
                "Registration is closed"));

        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new RpcException(new Status(StatusCode.AlreadyExists,
                "Email already registered"));

        // Use a serializable transaction to prevent two concurrent registrations
        // from consuming the same invite token simultaneously.
        await using var tx = await db.Database.BeginTransactionAsync(
            System.Data.IsolationLevel.Serializable, ct);

        if (mode == "invite_only")
        {
            var invite = await db.InviteTokens
                .FirstOrDefaultAsync(t =>
                    t.Token == request.InviteToken &&
                    !t.IsUsed &&
                    (t.ExpiresAt == null || t.ExpiresAt > DateTime.UtcNow), ct);

            if (invite is null)
                throw new RpcException(new Status(StatusCode.PermissionDenied,
                    "Invalid or expired invite token"));
        }

        var isFirst = !await db.Users.AnyAsync(ct);

        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = isFirst ? "Admin" : "User",
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        if (mode == "invite_only")
        {
            var invite = await db.InviteTokens
                .FirstAsync(t => t.Token == request.InviteToken, ct);
            invite.IsUsed = true;
            invite.UsedAt = DateTime.UtcNow;
            invite.UsedByUserId = user.Id;
            await db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);

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
        var ct = context.CancellationToken;
        var http = context.GetHttpContext();
        var rawToken = http.Request.Cookies[jwt.CookieName];

        if (string.IsNullOrEmpty(rawToken))
        {
            return Unauthenticated(context, "Missing refresh token");
        }

        var principal = jwt.ValidateRefreshToken(rawToken);
        if (principal is null)
        {
            return Unauthenticated(context, "Invalid or expired refresh token");
        }

        var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthenticated(context, "Invalid user identifier in token");
        }

        var tokenHash = JwtService.HashToken(rawToken);

        var stored = await db.RefreshTokens
            .FirstOrDefaultAsync(t =>
                t.TokenHash == tokenHash &&
                !t.IsRevoked &&
                t.ExpiresAt > DateTime.UtcNow, ct);

        if (stored is null)
        {
            return Unauthenticated(context, "Refresh token revoked or not found");
        }

        var user = await db.Users.FindAsync([userId], ct);
        if (user is null)
        {
            return Unauthenticated(context, "User not found");
        }

        stored.IsRevoked = true;
        stored.RevokedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        return await IssueTokens(user, http, ct);
    }

    private AuthResponse Unauthenticated(ServerCallContext context, string detail)
    {
        context.Status = new Status(StatusCode.Unauthenticated, detail);
        return new AuthResponse();
    }

    public override async Task<Empty> Logout(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var http = context.GetHttpContext();
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

    [AllowAnonymous]
    public override async Task<RegistrationStatus> GetRegistrationStatus(
        Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var hasAdmin = await db.Users.AnyAsync(ct);
        var settings = await db.SiteSettings
            .Where(s => s.Key == "registration_mode" || s.Key == "community_window_days")
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);
        var mode = settings.GetValueOrDefault("registration_mode", "open");
        var windowDays = int.TryParse(settings.GetValueOrDefault("community_window_days", "1"), out var d) ? d : 1;
        return new RegistrationStatus { HasAdmin = hasAdmin, RegistrationMode = mode, CommunityWindowDays = windowDays };
    }

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

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<AuthResponse> IssueTokens(
        User user, HttpContext http, CancellationToken ct)
    {
        var accessToken = jwt.GenerateAccessToken(user);
        var refreshToken = jwt.GenerateRefreshToken(user);

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = JwtService.HashToken(refreshToken),
            IssuedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(jwt.RefreshExpiryDays),
        });
        await db.SaveChangesAsync(ct);

        http.Response.Cookies.Append(jwt.CookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure = http.Request.IsHttps,
            Expires = DateTimeOffset.UtcNow.AddDays(jwt.RefreshExpiryDays),
        });

        return new AuthResponse
        {
            AccessToken = accessToken,
            Email = user.Email,
            UserId = user.Id.ToString(),
            Role = user.Role,
        };
    }
}
