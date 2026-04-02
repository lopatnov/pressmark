using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Services;

public class JwtService
{
    private readonly SymmetricSecurityKey _key;
    private readonly int _expiryMinutes;
    private readonly int _refreshExpiryDays;
    private const int MinSecretLength = 32; // Minimum 256 bits for HMAC-SHA256

    public string CookieName { get; }
    public int RefreshExpiryDays => _refreshExpiryDays;

    public JwtService(IConfiguration config)
    {
        var secret = config["Jwt:Secret"] 
            ?? throw new InvalidOperationException("Jwt:Secret is required");
        
        if (secret.Length < MinSecretLength)
        {
            throw new InvalidOperationException(
                $"Jwt:Secret must be at least {MinSecretLength} characters long (current length: {secret.Length}). " +
                "Use a strong random string of at least 32 characters for HMAC-SHA256.");
        }

        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        _expiryMinutes = int.Parse(config["Jwt:ExpiryMinutes"] ?? "15");
        _refreshExpiryDays = int.Parse(config["Jwt:RefreshExpiryDays"] ?? "7");
        CookieName = config["Jwt:RefreshCookieName"] ?? "refresh_token";
    }

    public string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
        };
        return CreateToken(claims, TimeSpan.FromMinutes(_expiryMinutes));
    }

    public string GenerateRefreshToken(User user)
    {
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()) };
        return CreateToken(claims, TimeSpan.FromDays(_refreshExpiryDays));
    }

    public ClaimsPrincipal? ValidateRefreshToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = _key,
                ValidateIssuer = false,
                ValidateAudience = false,
                ClockSkew = TimeSpan.Zero,
            }, out _);
        }
        catch
        {
            return null;
        }
    }

    public static string HashToken(string raw)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private string CreateToken(IEnumerable<Claim> claims, TimeSpan lifetime)
    {
        var creds = new SigningCredentials(_key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.Add(lifetime),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
