using System.Security.Claims;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Session lifecycle: rotating a refresh token for a fresh access token, and
/// tearing the session down on logout.
/// See AuthServiceImpl.cs for the primary constructor.
/// </summary>
public partial class AuthServiceImpl
{
    [DisableRateLimiting]
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
        var now = DateTime.UtcNow;

        // Rotate first: claiming the presented token is a single conditional UPDATE, so
        // exactly one of any number of concurrent requests can move it from active to
        // revoked. Reading it and revoking it in separate round trips let a replayed
        // (e.g. stolen) token mint a second session before the first revoke landed.
        var claimed = await db.RefreshTokens
            .Where(t =>
                t.TokenHash == tokenHash &&
                !t.IsRevoked &&
                t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.IsRevoked, true)
                .SetProperty(t => t.RevokedAt, now), ct);

        if (claimed == 0)
        {
            return Unauthenticated(context, "Refresh token revoked or not found");
        }

        var user = await db.Users.FindAsync([userId], ct);
        if (user is null)
        {
            return Unauthenticated(context, "User not found");
        }

        if (user.IsSiteBanned)
        {
            // The token is already revoked by the claim above; just drop the cookie.
            http.Response.Cookies.Delete(jwt.CookieName);
            return Unauthenticated(context, "account_banned");
        }

        return await tokenIssuer.IssueAsync(user, http, ct);
    }

    [DisableRateLimiting]
    public override async Task<Empty> Logout(Empty request, ServerCallContext context)
    {
        var ct = context.CancellationToken;
        var http = context.GetHttpContext();
        var rawToken = http.Request.Cookies[jwt.CookieName];

        if (!string.IsNullOrEmpty(rawToken))
        {
            var tokenHash = JwtService.HashToken(rawToken);
            var now = DateTime.UtcNow;

            // One conditional UPDATE, as in Refresh: revoking what a preceding read
            // returned leaves a window in which the token is still usable, and there is
            // nothing here that the read has to decide.
            await db.RefreshTokens
                .Where(t => t.TokenHash == tokenHash && !t.IsRevoked)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.IsRevoked, true)
                    .SetProperty(t => t.RevokedAt, now), ct);
        }

        http.Response.Cookies.Delete(jwt.CookieName);
        return new Empty();
    }

    /// <summary>
    /// Reports an unauthenticated refresh as a call status rather than an exception,
    /// so the client receives an empty <see cref="AuthResponse"/> instead of a fault.
    /// </summary>
    private static AuthResponse Unauthenticated(ServerCallContext context, string detail)
    {
        context.Status = new Status(StatusCode.Unauthenticated, detail);
        return new AuthResponse();
    }
}
