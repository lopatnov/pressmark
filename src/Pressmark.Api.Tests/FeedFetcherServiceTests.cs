using System.Net;
using System.Net.Http;
using System.Text;
using System.Xml;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Services;
using Xunit;

namespace Pressmark.Api.Tests;

public class FeedFetcherServiceTests
{
    private readonly Mock<IHttpClientFactory> _httpClientFactoryMock;
    private readonly Mock<FeedUpdateBroadcaster> _broadcasterMock;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<ILogger<FeedFetcherService>> _loggerMock;
    private readonly FeedFetcherService _feedFetcherService;

    public FeedFetcherServiceTests()
    {
        _httpClientFactoryMock = new Mock<IHttpClientFactory>();
        _broadcasterMock = new Mock<FeedUpdateBroadcaster>();
        _configMock = new Mock<IConfiguration>();
        _configMock.Setup(c => c["RssFetcher:MaxItemsPerFeed"]).Returns("50");
        _loggerMock = new Mock<ILogger<FeedFetcherService>>();

        _feedFetcherService = new FeedFetcherService(
            _httpClientFactoryMock.Object,
            _broadcasterMock.Object,
            _configMock.Object,
            _loggerMock.Object);
    }

    private static AppDbContext CreateInMemoryDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;

        return new AppDbContext(options);
    }

    private static Subscription CreateTestSubscription(string url = "https://example.com/rss")
    {
        return new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = url,
            RssUrl = url,
            Title = "Test Feed",
            CreatedAt = DateTime.UtcNow,
            LastFetchedAt = null,
        };
    }

    private static string CreateValidRssXml(string title = "Test Item", string link = "https://example.com/article")
    {
        return $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<rss version=""2.0"">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test Description</description>
    <item>
      <title>{title}</title>
      <link>{link}</link>
      <description>Test description</description>
      <pubDate>{DateTime.UtcNow:R}</pubDate>
    </item>
  </channel>
</rss>";
    }

    #region Happy Path Tests

    [Fact]
    public async Task FetchAndSaveAsync_ValidRss_SavesNewItem()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_ValidRss_SavesNewItem_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            CreateValidRssXml(), 
            "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        var result = await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        Assert.Equal(1, result);
        Assert.Single(db.FeedItems);
        var item = db.FeedItems.First();
        Assert.Equal("Test Item", item.Title);
        Assert.Equal("https://example.com/article", item.Url);
        Assert.Equal(subscription.Id, item.SubscriptionId);
    }

    [Fact]
    public async Task FetchAndSaveAsync_DuplicateItems_DoesNotSaveDuplicates()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_DuplicateItems_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        
        var existingItem = new FeedItem
        {
            SubscriptionId = subscription.Id,
            Url = "https://example.com/article",
            Title = "Existing Item",
            PublishedAt = DateTime.UtcNow,
        };
        db.FeedItems.Add(existingItem);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            CreateValidRssXml(), 
            "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        var result = await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        Assert.Equal(0, result);
        Assert.Single(db.FeedItems);
    }

    #endregion

    #region Error Handling Tests

    [Fact]
    public async Task FetchAndSaveAsync_HttpRequestFailed_ThrowsHttpRequestException()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_HttpRequestFailed_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            HttpStatusCode.NotFound, 
            "Not Found"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act & Assert
        await Assert.ThrowsAnyAsync<HttpRequestException>(() => 
            _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None));
    }

    [Fact]
    public async Task FetchAndSaveAsync_InvalidXml_ThrowsXmlException()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_InvalidXml_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            "This is not valid XML!", 
            "text/plain"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act & Assert
        await Assert.ThrowsAnyAsync<XmlException>(() => 
            _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None));
    }

    [Fact]
    public async Task FetchAndSaveAsync_EmptyRss_ReturnsZero()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_EmptyRss_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var emptyRss = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<rss version=""2.0"">
  <channel>
    <title>Empty Feed</title>
    <link>https://example.com</link>
    <description>No items</description>
  </channel>
</rss>";

        var httpClient = new HttpClient(new MockHttpMessageHandler(emptyRss, "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        var result = await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        Assert.Equal(0, result);
        Assert.Empty(db.FeedItems);
    }

    [Fact]
    public async Task FetchAndSaveAsync_NoLinksInItem_SkipsItem()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_NoLinksInItem_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var rssWithoutLinks = $@"<?xml version=""1.0"" encoding=""UTF-8""?>
<rss version=""2.0"">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>Test</description>
    <item>
      <title>No Link Item</title>
      <description>No link in this item</description>
    </item>
  </channel>
</rss>";

        var httpClient = new HttpClient(new MockHttpMessageHandler(rssWithoutLinks, "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        var result = await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        Assert.Equal(0, result);
        Assert.Empty(db.FeedItems);
    }

    [Fact]
    public async Task FetchAndSaveAsync_CancellationTokenCancelled_ThrowsOperationCanceledException()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_CancellationTokenCancelled_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            CreateValidRssXml(), 
            "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        var cts = new CancellationTokenSource();
        cts.Cancel();

        // Act & Assert
        await Assert.ThrowsAsync<TaskCanceledException>(() => 
            _feedFetcherService.FetchAndSaveAsync(db, subscription, cts.Token));
    }

    #endregion

    #region Broadcast Tests

    [Fact]
    public async Task FetchAndSaveAsync_NewItems_BroadcastsUpdates()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_NewItems_BroadcastsUpdates_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        var httpClient = new HttpClient(new MockHttpMessageHandler(
            CreateValidRssXml(), 
            "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        _broadcasterMock.Verify(b => b.BroadcastAsync(It.IsAny<FeedUpdateEvent>(), It.IsAny<CancellationToken>()), 
            Times.Once);
    }

    #endregion

    #region Max Items Tests

    [Fact]
    public async Task FetchAndSaveAsync_MoreThanMaxItems_LimitsToMaxItems()
    {
        // Arrange
        var dbName = $"FetchAndSaveAsync_MoreThanMaxItems_{Guid.NewGuid()}";
        await using var db = CreateInMemoryDbContext(dbName);

        var subscription = CreateTestSubscription();
        db.Subscriptions.Add(subscription);
        await db.SaveChangesAsync();

        // Create RSS with 60 items (max is 50)
        var sb = new StringBuilder();
        sb.AppendLine(@"<?xml version=""1.0"" encoding=""UTF-8""?>
<rss version=""2.0"">
  <channel>
    <title>Large Feed</title>
    <link>https://example.com</link>");
        
        for (int i = 0; i < 60; i++)
        {
            sb.AppendLine($@"    <item>
      <title>Item {i}</title>
      <link>https://example.com/article{i}</link>
      <description>Description {i}</description>
    </item>");
        }
        
        sb.AppendLine(@"  </channel>
</rss>");

        var httpClient = new HttpClient(new MockHttpMessageHandler(sb.ToString(), "application/rss+xml"));
        
        _httpClientFactoryMock.Setup(f => f.CreateClient("Pressmark"))
            .Returns(httpClient);

        // Act
        var result = await _feedFetcherService.FetchAndSaveAsync(db, subscription, CancellationToken.None);

        // Assert
        Assert.Equal(50, result);
        Assert.Equal(50, db.FeedItems.Count());
    }

    #endregion

    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly string? _content;
        private readonly string? _contentType;
        private readonly HttpStatusCode? _statusCode;

        public MockHttpMessageHandler(string content, string contentType)
        {
            _content = content;
            _contentType = contentType;
        }

        public MockHttpMessageHandler(HttpStatusCode statusCode, string statusDescription)
        {
            _statusCode = statusCode;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (_statusCode.HasValue)
            {
                return Task.FromResult(new HttpResponseMessage(_statusCode.Value)
                {
                    ReasonPhrase = _content ?? statusDescription
                });
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(_content!, Encoding.UTF8, _contentType!)
            });
        }
    }
}
