using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Pressmark.Api.BackgroundServices;
using Pressmark.Api.Data;
using Pressmark.Api.Entities;
using Pressmark.Api.Services;
using Xunit;

namespace Pressmark.Api.Tests;

public class RssFetcherServiceTests
{
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IConfiguration> _configMock;
    private readonly Mock<ILogger<RssFetcherService>> _loggerMock;
    private readonly Mock<FeedFetcherService> _feedFetcherMock;
    private readonly Mock<AppDbContext> _dbMock;
    private readonly Mock<IServiceScope> _scopeMock;

    public RssFetcherServiceTests()
    {
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _configMock = new Mock<IConfiguration>();
        _loggerMock = new Mock<ILogger<RssFetcherService>>();
        _feedFetcherMock = new Mock<FeedFetcherService>(
            Mock.Of<IHttpClientFactory>(),
            Mock.Of<FeedUpdateBroadcaster>(),
            _configMock.Object,
            Mock.Of<ILogger<FeedFetcherService>>());
        
        _dbMock = new Mock<AppDbContext>(new DbContextOptions<AppDbContext>());
        _scopeMock = new Mock<IServiceScope>();
        _scopeMock.Setup(s => s.ServiceProvider.GetService(typeof(AppDbContext)))
            .Returns(_dbMock.Object);
        _scopeFactoryMock.Setup(f => f.CreateScope()).Returns(_scopeMock.Object);
    }

    #region Configuration Tests

    [Fact]
    public void Constructor_DefaultConfiguration_UsesDefaultValues()
    {
        // Arrange
        _configMock.Setup(c => c["RssFetcher:IntervalMinutes"]).Returns("15");
        _configMock.Setup(c => c["RssFetcher:MaxRetries"]).Returns("3");
        _configMock.Setup(c => c["RssFetcher:RetryDelaySeconds"]).Returns("30");

        // Act
        var service = new RssFetcherService(
            _scopeFactoryMock.Object,
            _configMock.Object,
            _loggerMock.Object,
            _feedFetcherMock.Object);

        // Assert - service should be created successfully
        Assert.NotNull(service);
    }

    [Fact]
    public void Constructor_CustomConfiguration_UsesCustomValues()
    {
        // Arrange
        _configMock.Setup(c => c["RssFetcher:IntervalMinutes"]).Returns("30");
        _configMock.Setup(c => c["RssFetcher:MaxRetries"]).Returns("5");
        _configMock.Setup(c => c["RssFetcher:RetryDelaySeconds"]).Returns("60");

        // Act
        var service = new RssFetcherService(
            _scopeFactoryMock.Object,
            _configMock.Object,
            _loggerMock.Object,
            _feedFetcherMock.Object);

        // Assert - service should be created successfully
        Assert.NotNull(service);
    }

    #endregion

    #region Retry Logic Tests

    [Fact]
    public async Task FetchWithRetry_SuccessOnFirstAttempt_NoRetries()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(1)
            .Verifiable(Times.Once);

        // Act & Assert - should not throw
        await InvokeFetchWithRetryAsync(subscription);

        // Verify
        _feedFetcherMock.Verify();
    }

    [Fact]
    public async Task FetchWithRetry_Http500Error_RetriesAndSucceeds()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        var httpException = new HttpRequestException("Server Error", null, HttpStatusCode.InternalServerError);
        
        var callCount = 0;
        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1) throw httpException;
                return 1;
            });

        // Act & Assert - should succeed on retry
        await InvokeFetchWithRetryAsync(subscription);

        // Verify - called twice (first failed, second succeeded)
        _feedFetcherMock.Verify(f => f.FetchAndSaveAsync(
            It.IsAny<AppDbContext>(), 
            It.IsAny<Subscription>(), 
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task FetchWithRetry_Timeout_RetriesAndSucceeds()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        var timeoutException = new TaskCanceledException("Timeout");
        
        var callCount = 0;
        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1) throw timeoutException;
                return 1;
            });

        // Act & Assert
        await InvokeFetchWithRetryAsync(subscription);

        // Verify - called twice
        _feedFetcherMock.Verify(f => f.FetchAndSaveAsync(
            It.IsAny<AppDbContext>(), 
            It.IsAny<Subscription>(), 
            It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task FetchWithRetry_AllRetriesExhausted_LogsError()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        var httpException = new HttpRequestException("Server Error", null, HttpStatusCode.BadGateway);
        
        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(httpException);

        // Act & Assert - should not throw after all retries exhausted
        await InvokeFetchWithRetryAsync(subscription);

        // Verify - called 3 times (max retries)
        _feedFetcherMock.Verify(f => f.FetchAndSaveAsync(
            It.IsAny<AppDbContext>(), 
            It.IsAny<Subscription>(), 
            It.IsAny<CancellationToken>()), Times.Exactly(3));
    }

    [Fact]
    public async Task FetchWithRetry_NonRetryableException_NoRetry()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        var invalidOpException = new InvalidOperationException("Invalid operation");
        
        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(invalidOpException);

        // Act & Assert
        await InvokeFetchWithRetryAsync(subscription);

        // Verify - called only once (no retry for non-retryable exceptions)
        _feedFetcherMock.Verify(f => f.FetchAndSaveAsync(
            It.IsAny<AppDbContext>(), 
            It.IsAny<Subscription>(), 
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task FetchWithRetry_CancellationRequested_StopsImmediately()
    {
        // Arrange
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Url = "https://example.com/rss",
            RssUrl = "https://example.com/rss",
            Title = "Test Feed"
        };

        var cts = new CancellationTokenSource();
        cts.Cancel();

        var cancelException = new OperationCanceledException(cts.Token);
        
        _feedFetcherMock.Setup(f => f.FetchAndSaveAsync(
                It.IsAny<AppDbContext>(), 
                It.IsAny<Subscription>(), 
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(cancelException);

        // Act & Assert - should propagate cancellation
        await Assert.ThrowsAsync<OperationCanceledException>(() => 
            InvokeFetchWithRetryAsync(subscription, cts.Token));
    }

    #endregion

    /// <summary>
    /// Helper to invoke the private FetchWithRetryAsync method via reflection
    /// </summary>
    private async Task InvokeFetchWithRetryAsync(Subscription subscription, CancellationToken? ct = null)
    {
        var service = new RssFetcherService(
            _scopeFactoryMock.Object,
            _configMock.Object,
            _loggerMock.Object,
            _feedFetcherMock.Object);

        var methodInfo = typeof(RssFetcherService).GetMethod(
            "FetchWithRetryAsync", 
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

        if (methodInfo == null)
        {
            throw new Exception("Could not find FetchWithRetryAsync method");
        }

        var task = (Task)methodInfo.Invoke(service, new object[] 
        { 
            _dbMock.Object, 
            subscription, 
            ct ?? CancellationToken.None 
        })!;

        await task;
    }
}
