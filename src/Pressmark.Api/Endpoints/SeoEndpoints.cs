using System.Text;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.Endpoints;

/// <summary>
/// SEO/discovery endpoints: site metadata for OpenGraph tags, sitemap.xml, robots.txt.
/// Deliberately anonymous — the community page and these SEO endpoints are public by
/// design (see CLAUDE.md), not an oversight.
/// </summary>
internal static class SeoEndpoints
{
    private const string DefaultBaseUrl = "http://localhost:5173";

    internal static IEndpointRouteBuilder MapSeoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/meta", async (AppDbContext db, IConfiguration config, CancellationToken ct) =>
        {
            var settings = await SiteSettingsSnapshot.LoadAsync(db, [
                SiteSettingKeys.SiteName,
                SiteSettingKeys.SiteDescription,
            ], ct);
            var siteName = settings.SiteName;
            // Unlike the admin screen, an unset description is reported as empty here
            // rather than falling back to the seeded copy.
            var siteDescription = settings.Value(SiteSettingKeys.SiteDescription, "");
            var baseUrl = (config["App:BaseUrl"] ?? DefaultBaseUrl).TrimEnd('/');
            return Results.Ok(new { siteName, siteDescription, baseUrl });
        }).AllowAnonymous();

        endpoints.MapGet("/sitemap.xml", async (AppDbContext db, IConfiguration config, CancellationToken ct) =>
        {
            var baseUrl = System.Security.SecurityElement.Escape(
                (config["App:BaseUrl"] ?? DefaultBaseUrl).TrimEnd('/'));
            var settings = await SiteSettingsSnapshot.LoadAsync(db, [
                SiteSettingKeys.RegistrationMode,
                SiteSettingKeys.CommunityPageEnabled,
            ], ct);

            var communityEnabled = settings.CommunityPageEnabled;
            var registrationOpen = settings.RegistrationMode == "open";
            var lastmod = DateTime.UtcNow.ToString("yyyy-MM-dd");

            var sb = new StringBuilder();
            sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
            sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
            if (communityEnabled)
                sb.AppendLine($"  <url><loc>{baseUrl}/</loc><lastmod>{lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>");
            sb.AppendLine($"  <url><loc>{baseUrl}/login</loc><lastmod>{lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>");
            if (registrationOpen)
                sb.AppendLine($"  <url><loc>{baseUrl}/register</loc><lastmod>{lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>");
            sb.AppendLine("</urlset>");

            return Results.Content(sb.ToString(), "application/xml");
        }).AllowAnonymous();

        endpoints.MapGet("/robots.txt", (IConfiguration config) =>
        {
            var baseUrl = (config["App:BaseUrl"] ?? DefaultBaseUrl).TrimEnd('/');
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

                Sitemap: {baseUrl}/sitemap.xml
                """;
            return Results.Content(content, "text/plain");
        }).AllowAnonymous();

        return endpoints;
    }
}
