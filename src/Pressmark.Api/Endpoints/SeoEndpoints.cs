using System.Text;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.Endpoints;

/// <summary>
/// The endpoints crawlers and the SPA shell read rather than the gRPC API:
/// the site metadata used to render OpenGraph tags, plus sitemap.xml and
/// robots.txt. All three are anonymous by design — they describe the public
/// surface of the instance.
/// </summary>
/// <remarks>
/// What they advertise follows the instance's own settings: a closed registration
/// or a disabled community page must not be listed in the sitemap as though a
/// visitor could reach it.
/// </remarks>
internal static class SeoEndpoints
{
    private const string DefaultBaseUrl = "http://localhost:5173";

    internal static WebApplication MapSeoEndpoints(this WebApplication app)
    {
        app.MapGet("/api/meta", GetMetaAsync).AllowAnonymous();
        app.MapGet("/sitemap.xml", GetSitemapAsync).AllowAnonymous();
        app.MapGet("/robots.txt", GetRobots).AllowAnonymous();
        return app;
    }

    private static async Task<IResult> GetMetaAsync(
        AppDbContext db, IConfiguration config, CancellationToken ct)
    {
        var settings = await SiteSettingsSnapshot.LoadAsync(db, [
            SiteSettingKeys.SiteName,
            SiteSettingKeys.SiteDescription,
        ], ct);

        return Results.Ok(new
        {
            siteName = settings.SiteName,
            // Unlike the admin screen, an unset description is reported as empty here
            // rather than falling back to the seeded copy.
            siteDescription = settings.Value(SiteSettingKeys.SiteDescription, ""),
            baseUrl = BaseUrl(config),
        });
    }

    private static async Task<IResult> GetSitemapAsync(
        AppDbContext db, IConfiguration config, CancellationToken ct)
    {
        var baseUrl = System.Security.SecurityElement.Escape(BaseUrl(config));
        var settings = await SiteSettingsSnapshot.LoadAsync(db, [
            SiteSettingKeys.RegistrationMode,
            SiteSettingKeys.CommunityPageEnabled,
        ], ct);

        var lastmod = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var sb = new StringBuilder();
        sb.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        sb.AppendLine("""<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">""");

        if (settings.CommunityPageEnabled)
            AppendUrl(sb, $"{baseUrl}/", lastmod, "daily", "1.0");

        AppendUrl(sb, $"{baseUrl}/login", lastmod, "monthly", "0.6");

        if (settings.RegistrationMode == "open")
            AppendUrl(sb, $"{baseUrl}/register", lastmod, "monthly", "0.5");

        sb.AppendLine("</urlset>");

        return Results.Content(sb.ToString(), "application/xml");
    }

    private static IResult GetRobots(IConfiguration config)
    {
        var content = $"""
            User-agent: *
            Allow: /
            Allow: /login
            Allow: /register
            Disallow: /feed
            Disallow: /subscriptions
            Disallow: /bookmarks
            Disallow: /admin
            Disallow: /article/

            Sitemap: {BaseUrl(config)}/sitemap.xml
            """;

        return Results.Content(content, "text/plain");
    }

    private static void AppendUrl(
        StringBuilder sb, string loc, string lastmod, string changefreq, string priority) =>
        sb.AppendLine(
            $"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod>" +
            $"<changefreq>{changefreq}</changefreq><priority>{priority}</priority></url>");

    private static string BaseUrl(IConfiguration config) =>
        (config["App:BaseUrl"] ?? DefaultBaseUrl).TrimEnd('/');
}
