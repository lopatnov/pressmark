using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// With <c>ResponseHeadersRead</c>, the connection stays checked out until the response
/// (and the stream it owns) is disposed — left to the GC, every og:image probe would
/// hold a socket. These tests pin that the probe disposes what it reads, not just that
/// it returns the right image.
/// </summary>
public class FeedFetcherServiceTests
{
    private sealed class TrackingStream(byte[] buffer) : MemoryStream(buffer)
    {
        public bool Disposed { get; private set; }

        protected override void Dispose(bool disposing)
        {
            Disposed = true;
            base.Dispose(disposing);
        }
    }

    private sealed class FakeHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct) => Task.FromResult(response);
    }

    private static (HttpClient Client, TrackingStream Stream) MakeClient(string html, string contentType = "text/html")
    {
        var stream = new TrackingStream(Encoding.UTF8.GetBytes(html));
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(stream) };
        response.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return (new HttpClient(new FakeHandler(response)), stream);
    }

    [Fact]
    public async Task TryFetchOgImageAsync_DisposesTheResponseStream_OnSuccess()
    {
        var html = "<html><head>" +
            "<meta property=\"og:image\" content=\"https://example.com/img.png\">" +
            "</head></html>";
        var (client, stream) = MakeClient(html);

        var result = await FeedFetcherService.TryFetchOgImageAsync(
            client, "https://example.com/article", CancellationToken.None);

        Assert.Equal("https://example.com/img.png", result);
        Assert.True(stream.Disposed);
    }

    [Fact]
    public async Task TryFetchOgImageAsync_DisposesTheResponseStream_WhenContentTypeIsNotHtml()
    {
        var (client, stream) = MakeClient("not html", contentType: "application/octet-stream");

        var result = await FeedFetcherService.TryFetchOgImageAsync(
            client, "https://example.com/file.bin", CancellationToken.None);

        Assert.Null(result);
        Assert.True(stream.Disposed);
    }
}
