using Pressmark.Api.Entities;
using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

public class OpmlServiceTests
{
    private const string ValidOpml = """
        <?xml version="1.0" encoding="UTF-8"?>
        <opml version="2.0">
          <head><title>Test</title></head>
          <body>
            <outline type="rss" text="Hacker News" title="Hacker News"
                     xmlUrl="https://news.ycombinator.com/rss" htmlUrl="https://news.ycombinator.com"/>
            <outline type="rss" text="GitHub Blog"
                     xmlUrl="https://github.blog/feed/" />
          </body>
        </opml>
        """;

    // ── Parse ─────────────────────────────────────────────────────────────────

    [Fact]
    public void Parse_ValidOpml_ReturnsAllFeeds()
    {
        var result = OpmlService.Parse(ValidOpml);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.RssUrl == "https://news.ycombinator.com/rss");
        Assert.Contains(result, r => r.RssUrl == "https://github.blog/feed/");
    }

    [Fact]
    public void Parse_UsesTextAttributeAsTitle()
    {
        var result = OpmlService.Parse(ValidOpml);
        var hn = result.First(r => r.RssUrl.Contains("ycombinator"));
        Assert.Equal("Hacker News", hn.Title);
    }

    [Fact]
    public void Parse_FallsBackToXmlUrlWhenNoTitle()
    {
        const string opml = """
            <?xml version="1.0"?>
            <opml version="2.0">
              <body>
                <outline xmlUrl="https://example.com/rss" />
              </body>
            </opml>
            """;

        var result = OpmlService.Parse(opml);
        Assert.Single(result);
        Assert.Equal("https://example.com/rss", result[0].Title);
    }

    [Fact]
    public void Parse_SkipsOutlinesWithoutXmlUrl()
    {
        const string opml = """
            <?xml version="1.0"?>
            <opml version="2.0">
              <body>
                <outline text="Category" />
                <outline text="Feed" xmlUrl="https://example.com/feed" />
              </body>
            </opml>
            """;

        var result = OpmlService.Parse(opml);
        Assert.Single(result);
    }

    [Fact]
    public void Parse_FiltersNonHttpSchemes()
    {
        const string opml = """
            <?xml version="1.0"?>
            <opml version="2.0">
              <body>
                <outline xmlUrl="ftp://example.com/feed" text="FTP" />
                <outline xmlUrl="https://example.com/feed" text="HTTPS" />
              </body>
            </opml>
            """;

        var result = OpmlService.Parse(opml);
        Assert.Single(result);
        Assert.Equal("https://example.com/feed", result[0].RssUrl);
    }

    [Fact]
    public void Parse_EmptyBody_ReturnsEmptyList()
    {
        const string opml = """
            <?xml version="1.0"?>
            <opml version="2.0"><body /></opml>
            """;

        Assert.Empty(OpmlService.Parse(opml));
    }

    // ── Generate ──────────────────────────────────────────────────────────────

    [Fact]
    public void Generate_RoundTrip_PreservesAllFeeds()
    {
        var subs = new[]
        {
            new Subscription { Id = Guid.NewGuid(), RssUrl = "https://a.com/rss", Title = "Feed A", UserId = Guid.NewGuid(), CreatedAt = DateTime.UtcNow },
            new Subscription { Id = Guid.NewGuid(), RssUrl = "https://b.com/rss", Title = "Feed B", UserId = Guid.NewGuid(), CreatedAt = DateTime.UtcNow },
        };

        var xml = OpmlService.Generate(subs);
        var parsed = OpmlService.Parse(xml);

        Assert.Equal(2, parsed.Count);
        Assert.Contains(parsed, r => r.RssUrl == "https://a.com/rss" && r.Title == "Feed A");
        Assert.Contains(parsed, r => r.RssUrl == "https://b.com/rss" && r.Title == "Feed B");
    }

    [Fact]
    public void Generate_EmptyList_ProducesValidXml()
    {
        var xml = OpmlService.Generate([]);
        Assert.Contains("<opml", xml);
        Assert.Empty(OpmlService.Parse(xml));
    }
}
