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

        if (mode != "open")
            throw new RpcException(new Status(StatusCode.FailedPrecondition,
                "Registration is closed"));

        if (await db.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new RpcException(new Status(StatusCode.AlreadyExists,
                "Email already registered"));

        var isFirst = !await db.Users.AnyAsync(ct);

        var user = new User
        {
            Email    = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role     = isFirst ? "Admin" : "User",
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);

        return IssueTokens(user, context.GetHttpContext());
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

        return IssueTokens(user, context.GetHttpContext());
    }

    public override async Task<AuthResponse> Refresh(
        RefreshRequest request, ServerCallContext context)
    {
        var http = context.GetHttpContext();
        var rawToken = http.Request.Cookies[jwt.CookieName];

        if (string.IsNullOrEmpty(rawToken))
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Missing refresh token"));

        var principal = jwt.ValidateRefreshToken(rawToken);
        if (principal is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated,
                "Invalid or expired refresh token"));

        var userId = Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user   = await db.Users.FindAsync([userId], context.CancellationToken);

        if (user is null)
            throw new RpcException(new Status(StatusCode.Unauthenticated, "User not found"));

        return IssueTokens(user, http);
    }

    public override Task<Empty> Logout(Empty request, ServerCallContext context)
    {
        context.GetHttpContext().Response.Cookies.Delete(jwt.CookieName);
        return Task.FromResult(new Empty());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private AuthResponse IssueTokens(User user, HttpContext http)
    {
        var accessToken  = jwt.GenerateAccessToken(user);
        var refreshToken = jwt.GenerateRefreshToken(user);

        http.Response.Cookies.Append(jwt.CookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure   = !http.Request.IsHttps ? false : true,
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
