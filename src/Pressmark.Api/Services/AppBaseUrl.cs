namespace Pressmark.Api.Services;

/// <summary>
/// The public address of the web app, which every absolute link the API hands out is
/// built against: links in emails (password reset, invites, comment notifications, the
/// digest) and the SEO endpoints.
/// </summary>
/// <remarks>
/// Read in one place so the configuration key and the development fallback cannot
/// drift between call sites — a wrong base URL here means broken links in mail that
/// has already been sent.
/// </remarks>
internal static class AppBaseUrl
{
    private const string ConfigKey = "App:BaseUrl";

    /// <summary>The Vite dev server, for running without configuration.</summary>
    private const string DevelopmentFallback = "http://localhost:5173";

    /// <summary>Returns the configured base URL without a trailing slash.</summary>
    internal static string GetAppBaseUrl(this IConfiguration config) =>
        (config[ConfigKey] ?? DevelopmentFallback).TrimEnd('/');
}
