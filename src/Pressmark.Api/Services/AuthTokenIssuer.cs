using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Protos;

namespace Pressmark.Api.Services;

/// <summary>
/// Issues a signed-in session: mints the access and refresh tokens, records the
/// refresh token's hash so it can be revoked, and plants the refresh cookie.
/// </summary>
/// <remarks>
/// Shared by registration, login and refresh, which must all establish a session
/// identically — only the hash of a refresh token is ever persisted.
/// </remarks>
public class AuthTokenIssuer(AppDbContext db, JwtService jwt, IWebHostEnvironment env)
{
    public async Task<AuthResponse> IssueAsync(User user, HttpContext http, CancellationToken ct)
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

        // NOSONAR: Secure is always true outside Development; in dev it tracks the actual
        // request scheme so plain http://localhost keeps working (see commits 04702e8, 41b6dd0).
        http.Response.Cookies.Append(jwt.CookieName, refreshToken, new CookieOptions // NOSONAR
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Strict,
            Secure = !env.IsDevelopment() || http.Request.IsHttps,
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
