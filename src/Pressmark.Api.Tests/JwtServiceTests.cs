using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Configuration;
using Pressmark.Api.Entities;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

public class JwtServiceTests
{
    private static JwtService BuildService(int expiryMinutes = 15, int refreshDays = 7)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "super-secret-key-that-is-long-enough-for-hmac",
                ["Jwt:ExpiryMinutes"] = expiryMinutes.ToString(),
                ["Jwt:RefreshExpiryDays"] = refreshDays.ToString(),
                ["Jwt:RefreshCookieName"] = "refresh_token",
            })
            .Build();
        return new JwtService(config);
    }

    private static User MakeUser() => new()
    {
        Id = Guid.NewGuid(),
        Email = "test@example.com",
        Role = "User",
        PasswordHash = "hash",
        CreatedAt = DateTime.UtcNow,
    };

    // ── GenerateAccessToken ───────────────────────────────────────────────────

    [Fact]
    public void GenerateAccessToken_ContainsNameIdentifier()
    {
        var svc = BuildService();
        var user = MakeUser();

        var token = svc.GenerateAccessToken(user);
        var principal = svc.ValidateRefreshToken(token);

        // access tokens use the same signing key so ValidateRefreshToken can read them
        var sub = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        Assert.Equal(user.Id.ToString(), sub);
    }

    [Fact]
    public void GenerateAccessToken_ContainsEmailAndRoleClaims()
    {
        var svc = BuildService();
        var user = MakeUser();

        var raw = svc.GenerateAccessToken(user);
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(raw);

        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Email && c.Value == user.Email);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == user.Role);
    }

    // ── GenerateRefreshToken ──────────────────────────────────────────────────

    [Fact]
    public void GenerateRefreshToken_ValidateReturnsCorrectSub()
    {
        var svc = BuildService(refreshDays: 7);
        var user = MakeUser();

        var token = svc.GenerateRefreshToken(user);
        var principal = svc.ValidateRefreshToken(token);

        Assert.NotNull(principal);
        Assert.Equal(user.Id.ToString(), principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    // ── ValidateRefreshToken ──────────────────────────────────────────────────

    [Fact]
    public void ValidateRefreshToken_TamperedSignature_ReturnsNull()
    {
        var svc = BuildService();
        var token = svc.GenerateRefreshToken(MakeUser());

        // Corrupt the signature (last segment)
        var parts = token.Split('.');
        parts[2] = "invalidsignature";
        var tampered = string.Join('.', parts);

        Assert.Null(svc.ValidateRefreshToken(tampered));
    }

    [Fact]
    public void ValidateRefreshToken_CompletelyBogusToken_ReturnsNull()
    {
        var svc = BuildService();
        Assert.Null(svc.ValidateRefreshToken("not.a.jwt"));
    }

    [Fact]
    public void ValidateRefreshToken_ExpiredToken_ReturnsNull()
    {
        // expiryMinutes = 0 makes the token expire before it can be validated
        var svc = BuildService(expiryMinutes: -1);
        var token = svc.GenerateAccessToken(MakeUser());
        Assert.Null(svc.ValidateRefreshToken(token));
    }

    // ── HashToken ─────────────────────────────────────────────────────────────

    [Fact]
    public void HashToken_SameInput_ProducesSameHash()
    {
        var h1 = JwtService.HashToken("my-token");
        var h2 = JwtService.HashToken("my-token");
        Assert.Equal(h1, h2);
    }

    [Fact]
    public void HashToken_DifferentInputs_ProduceDifferentHashes()
    {
        Assert.NotEqual(JwtService.HashToken("token-a"), JwtService.HashToken("token-b"));
    }

    [Fact]
    public void HashToken_IsLowercaseHex()
    {
        var hash = JwtService.HashToken("any");
        Assert.Matches("^[0-9a-f]{64}$", hash);
    }

    // ── Config properties ─────────────────────────────────────────────────────

    [Fact]
    public void RefreshExpiryDays_ReflectsConfiguration()
    {
        Assert.Equal(14, BuildService(refreshDays: 14).RefreshExpiryDays);
    }

    [Fact]
    public void CookieName_ReflectsConfiguration()
    {
        Assert.Equal("refresh_token", BuildService().CookieName);
    }

    // ── Secret Validation ─────────────────────────────────────────────────────

    [Fact]
    public void Constructor_SecretTooShort_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "short",
                ["Jwt:ExpiryMinutes"] = "15",
                ["Jwt:RefreshExpiryDays"] = "7",
                ["Jwt:RefreshCookieName"] = "refresh_token",
            })
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => new JwtService(config));
        Assert.Contains("32", ex.Message);
        Assert.Contains("current length: 5", ex.Message);
    }

    [Fact]
    public void Constructor_SecretExactly32Chars_DoesNotThrow()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "12345678901234567890123456789012", // exactly 32 chars
                ["Jwt:ExpiryMinutes"] = "15",
                ["Jwt:RefreshExpiryDays"] = "7",
                ["Jwt:RefreshCookieName"] = "refresh_token",
            })
            .Build();

        var svc = new JwtService(config);
        Assert.NotNull(svc);
    }

    [Fact]
    public void Constructor_MissingSecret_ThrowsInvalidOperationException()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:ExpiryMinutes"] = "15",
                ["Jwt:RefreshExpiryDays"] = "7",
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() => new JwtService(config));
    }
}
