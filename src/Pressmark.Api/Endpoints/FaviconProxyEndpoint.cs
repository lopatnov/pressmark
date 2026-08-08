namespace Pressmark.Api.Endpoints;

/// <summary>
/// Server-side favicon proxy: fetches an external site's <c>favicon.ico</c> so the
/// community/feed pages can render it without a direct cross-origin/mixed-content
/// request from the browser. Deliberately anonymous and unauthenticated — the
/// community page itself is public by design (see CLAUDE.md) — which is exactly why it
/// needs its own rate limit and strict SSRF defenses (<see cref="SsrfGuard"/>): unlike
/// the gRPC services, nothing here requires a logged-in caller to trigger an outbound
/// server-side fetch.
/// </summary>
internal static class FaviconProxyEndpoint
{
    private const string HttpClientName = "FaviconProxy";
    internal const string RateLimitPolicyName = "favicon-proxy";
    private const int MaxFaviconBytes = 1024 * 1024; // 1 MB
    private static readonly TimeSpan FetchTimeout = TimeSpan.FromSeconds(5);

    /// <summary>
    /// Registers the named HTTP client used only by this endpoint. Kept separate from
    /// the shared "Pressmark" client (used by <c>FeedFetcherService</c> for RSS/OPML
    /// fetches, which legitimately need to follow redirects) so disabling redirects and
    /// routing through <see cref="SsrfGuard"/> here can't affect unrelated call sites.
    /// </summary>
    internal static IServiceCollection AddFaviconProxyHttpClient(this IServiceCollection services)
    {
        services.AddHttpClient(HttpClientName, c =>
            {
                c.DefaultRequestHeaders.UserAgent.ParseAdd("Pressmark/1.0");
                c.Timeout = FetchTimeout;
            })
            .ConfigurePrimaryHttpMessageHandler(CreateHandler);
        return services;
    }

    /// <summary>
    /// Redirects are disabled: without this, a public/allowed host could 302 to a
    /// blocked target and slip past the SSRF check, since only the original URL's host
    /// would have been validated. <see cref="SsrfGuard.ConnectAsync"/> is used as the
    /// connect callback so every socket connect — including any the handler itself would
    /// otherwise make — is validated at connect time, not just the original request URL.
    /// </summary>
    internal static SocketsHttpHandler CreateHandler() => new()
    {
        AllowAutoRedirect = false,
        ConnectCallback = SsrfGuard.ConnectAsync,
        ConnectTimeout = FetchTimeout,
    };

    internal static IEndpointRouteBuilder MapFaviconProxy(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/proxy/favicon", HandleAsync)
            .RequireRateLimiting(RateLimitPolicyName);
        return endpoints;
    }

    private static async Task<IResult> HandleAsync(
        string? url, IHttpClientFactory httpClientFactory, HttpContext ctx)
    {
        if (string.IsNullOrWhiteSpace(url))
            return Results.NoContent();

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return Results.NoContent();

        var faviconUrl = uri.GetLeftPart(UriPartial.Authority) + "/favicon.ico";

        try
        {
            var client = httpClientFactory.CreateClient(HttpClientName);
            // Linked to the request so a disconnected client also drops the outbound fetch.
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
            cts.CancelAfter(FetchTimeout);
            using var response = await client.GetAsync(faviconUrl, cts.Token);

            if (!response.IsSuccessStatusCode)
                return Results.NoContent();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
            if (!contentType.StartsWith("image/"))
                return Results.NoContent();

            if (response.Content.Headers.ContentLength > MaxFaviconBytes)
                return Results.NoContent();

            var bytes = await response.Content.ReadAsByteArrayAsync(cts.Token);
            if (bytes.Length > MaxFaviconBytes)
                return Results.NoContent();

            ctx.Response.Headers.CacheControl = "public, max-age=86400";
            return Results.Bytes(bytes, contentType);
        }
        catch
        {
            // Covers: SSRF rejection thrown by SsrfGuard.ConnectAsync, DNS failures,
            // connect/read timeouts, and any other transport error — all collapse to the
            // same "no favicon available" response so nothing about the target is leaked.
            return Results.NoContent();
        }
    }
}
