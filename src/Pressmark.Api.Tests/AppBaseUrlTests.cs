using Microsoft.Extensions.Configuration;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// Every emailed link is the base URL plus a path that starts with '/', so the base
/// must never end in one — an operator configuring "https://example.com/" would
/// otherwise send links containing "//".
/// </summary>
public class AppBaseUrlTests
{
    private static IConfiguration Config(string? baseUrl) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:BaseUrl"] = baseUrl })
            .Build();

    [Fact]
    public void GetAppBaseUrl_StripsATrailingSlash()
    {
        Assert.Equal("https://example.com", Config("https://example.com/").GetAppBaseUrl());
    }

    [Fact]
    public void GetAppBaseUrl_ReturnsAConfiguredValueAsIs()
    {
        Assert.Equal("https://example.com/news", Config("https://example.com/news").GetAppBaseUrl());
    }

    [Fact]
    public void GetAppBaseUrl_FallsBackToTheDevServer_WhenUnset()
    {
        Assert.Equal("http://localhost:5173", Config(null).GetAppBaseUrl());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void GetAppBaseUrl_FallsBackToTheDevServer_WhenBlank(string blank)
    {
        // A blank value is as unconfigured as a missing one — treating it as a
        // real base URL would send already-sent mail links as relative paths.
        Assert.Equal("http://localhost:5173", Config(blank).GetAppBaseUrl());
    }
}
