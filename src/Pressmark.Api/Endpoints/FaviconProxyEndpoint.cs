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

            // ResponseHeadersRead: the default GetAsync completion option buffers the
            // whole body into memory before any check here gets to run, so a malicious
            // server's (untrustworthy) Content-Length couldn't bound anything. Reading
            // headers only, then copying the body ourselves with a hard byte cap, is what
            // actually bounds memory use against an oversized or Content-Length-lying response.
            using var response = await client.GetAsync(
                faviconUrl, HttpCompletionOption.ResponseHeadersRead, cts.Token);

            if (!response.IsSuccessStatusCode)
                return Results.NoContent();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
            if (!contentType.StartsWith("image/"))
                return Results.NoContent();

            if (response.Content.Headers.ContentLength > MaxFaviconBytes)
                return Results.NoContent();

            await using var responseStream = await response.Content.ReadAsStreamAsync(cts.Token);
            using var buffer = new MemoryStream();
            if (!await responseStream.CopyToLimitedAsync(buffer, MaxFaviconBytes, cts.Token))
                return Results.NoContent();

            ctx.Response.Headers.CacheControl = "public, max-age=86400";
            return Results.Bytes(buffer.ToArray(), contentType);
        }
        catch
        {
            // Covers: SSRF rejection thrown by SsrfGuard.ConnectAsync, DNS failures,
            // connect/read timeouts, and any other transport error — all collapse to the
            // same "no favicon available" response so nothing about the target is leaked.
            return Results.NoContent();
        }
    }

    /// <summary>
    /// Copies <paramref name="source"/> into <paramref name="destination"/>, stopping as
    /// soon as more than <paramref name="maxBytes"/> have been read. Returns false (without
    /// having buffered the excess) if the source turned out to be larger than the limit —
    /// callers must not trust <c>Content-Length</c> to have bounded this already, since it
    /// is server-supplied and can undercount or be absent.
    /// </summary>
    private static async Task<bool> CopyToLimitedAsync(
        this Stream source, Stream destination, int maxBytes, CancellationToken ct)
    {
        var buffer = new byte[8192];
        var total = 0;
        int read;
        while ((read = await source.ReadAsync(buffer, ct)) > 0)
        {
            total += read;
            if (total > maxBytes) return false;
            await destination.WriteAsync(buffer.AsMemory(0, read), ct);
        }
        return true;
    }
}
