namespace Pressmark.Api.Endpoints;

/// <summary>
/// Serves a subscription's favicon from the server instead of letting the browser
/// load it cross-origin, which CORB/CORP would otherwise block.
/// </summary>
/// <remarks>
/// This is the only endpoint that fetches a URL the caller chooses, so it is also
/// the only one that has to defend against being used to reach the server's own
/// network: the host is screened by <see cref="PrivateNetworkGuard"/> and the
/// response is bounded in both time and size. Every failure answers
/// <c>204 No Content</c> — the caller is a decorative <c>&lt;img&gt;</c>, and a
/// distinguishable error would turn the endpoint into a port scanner.
/// </remarks>
internal static class FaviconProxyEndpoint
{
    private const int MaxFaviconBytes = 1024 * 1024;
    private static readonly TimeSpan FetchTimeout = TimeSpan.FromSeconds(5);

    internal static WebApplication MapFaviconProxy(this WebApplication app)
    {
        app.MapGet("/proxy/favicon", GetFaviconAsync).AllowAnonymous();
        return app;
    }

    private static async Task<IResult> GetFaviconAsync(
        string? url, IHttpClientFactory httpClientFactory, HttpContext ctx)
    {
        if (string.IsNullOrWhiteSpace(url))
            return Results.NoContent();

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return Results.NoContent();

        if (PrivateNetworkGuard.IsBlocked(uri))
            return Results.NoContent();

        var faviconUrl = uri.GetLeftPart(UriPartial.Authority) + "/favicon.ico";

        try
        {
            var client = httpClientFactory.CreateClient("Pressmark");
            // Linked to the request so a disconnected client also drops the outbound fetch.
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
            cts.CancelAfter(FetchTimeout);
            using var response = await client.GetAsync(faviconUrl, cts.Token);

            if (!response.IsSuccessStatusCode)
                return Results.NoContent();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
            if (!contentType.StartsWith("image/"))
                return Results.NoContent();

            // Content-Length is a claim, so it is checked first as a cheap reject and
            // then again against what was actually read.
            if (response.Content.Headers.ContentLength > MaxFaviconBytes)
                return Results.NoContent();

            ctx.Response.Headers.CacheControl = "public, max-age=86400";
            var bytes = await response.Content.ReadAsByteArrayAsync(cts.Token);
            if (bytes.Length > MaxFaviconBytes)
                return Results.NoContent();

            return Results.Bytes(bytes, contentType);
        }
        catch
        {
            return Results.NoContent();
        }
    }
}
