using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;
using Pressmark.Api.Services;

namespace Pressmark.Api.BackgroundServices;

public class RssFetcherService(
    IServiceScopeFactory scopeFactory,
    IConfiguration config,
    ILogger<RssFetcherService> logger,
    FeedFetcherService feedFetcher) : BackgroundService
{
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(
        double.Parse(config["RssFetcher:IntervalMinutes"] ?? "15"));
    private readonly int _maxRetries = 
        int.Parse(config["RssFetcher:MaxRetries"] ?? "3");
    private readonly TimeSpan _retryDelay = TimeSpan.FromSeconds(
        double.Parse(config["RssFetcher:RetryDelaySeconds"] ?? "30"));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Stagger first run by 10 s to let the app finish starting up
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            await FetchAllAsync(stoppingToken);
            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task FetchAllAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var subscriptions = await db.Subscriptions.ToListAsync(ct);

        foreach (var sub in subscriptions)
        {
            if (ct.IsCancellationRequested) break;
            await FetchWithRetryAsync(db, sub, ct);
        }
    }

    private async Task FetchWithRetryAsync(AppDbContext db, Subscription sub, CancellationToken ct)
    {
        var attempt = 0;
        var lastException = default(Exception);

        while (attempt < _maxRetries)
        {
            try
            {
                await feedFetcher.FetchAndSaveAsync(db, sub, ct);
                return; // Success
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Don't retry on cancellation
                throw;
            }
            catch (HttpRequestException httpEx) when (httpEx.StatusCode >= 500)
            {
                // Retry on server errors (5xx)
                lastException = httpEx;
                attempt++;
                
                if (attempt < _maxRetries)
                {
                    logger.LogWarning(httpEx, 
                        "HTTP {StatusCode} error fetching RSS for subscription {Id} ({Url}). Retry {Attempt}/{MaxRetries} in {Delay}s",
                        httpEx.StatusCode, sub.Id, sub.RssUrl, attempt, _maxRetries, _retryDelay.TotalSeconds);
                    
                    await Task.Delay(_retryDelay, ct);
                }
            }
            catch (TaskCanceledException timeoutEx)
            {
                // Retry on timeout
                lastException = timeoutEx;
                attempt++;
                
                if (attempt < _maxRetries)
                {
                    logger.LogWarning(timeoutEx,
                        "Timeout fetching RSS for subscription {Id} ({Url}). Retry {Attempt}/{MaxRetries} in {Delay}s",
                        sub.Id, sub.RssUrl, attempt, _maxRetries, _retryDelay.TotalSeconds);
                    
                    await Task.Delay(_retryDelay, ct);
                }
            }
            catch (Exception ex)
            {
                // Log other exceptions without retry
                logger.LogWarning(ex, "Failed to fetch RSS for subscription {Id} ({Url})",
                    sub.Id, sub.RssUrl);
                return;
            }
        }

        // All retries exhausted
        if (lastException != null)
        {
            logger.LogError(lastException,
                "Failed to fetch RSS for subscription {Id} ({Url}) after {MaxRetries} attempts",
                sub.Id, sub.RssUrl, _maxRetries);
        }
    }
}
