namespace Pressmark.Api.BackgroundServices;

/// <summary>
/// The loop every scheduled job shares: wait out a start-up delay, then run one cycle
/// per interval until the host stops. Subclasses supply the timing and the cycle itself.
/// </summary>
/// <remarks>
/// Two rules live here so no job has to restate them:
/// <list type="bullet">
/// <item>
/// A failed cycle never ends the loop. An exception escaping
/// <see cref="BackgroundService.ExecuteAsync"/> stops the host, so a transient database
/// error in one job would otherwise take the whole API down until it was restarted.
/// </item>
/// <item>
/// Cancellation caused by shutdown is not a failure. A cycle interrupted by the host
/// stopping ends quietly instead of being logged as an error.
/// </item>
/// </list>
/// </remarks>
public abstract class PeriodicBackgroundService(ILogger logger) : BackgroundService
{
    /// <summary>The subclass's own logger, so its messages keep its category.</summary>
    protected ILogger Logger { get; } = logger;

    /// <summary>How long to wait after start-up before the first cycle.</summary>
    protected abstract TimeSpan InitialDelay { get; }

    /// <summary>How long to wait between the end of one cycle and the start of the next.</summary>
    protected abstract TimeSpan Interval { get; }

    /// <summary>
    /// Runs one cycle. May throw: a failure is logged and the next cycle still runs.
    /// Implementations should let an <see cref="OperationCanceledException"/> raised by
    /// <paramref name="ct"/> propagate rather than catching it as a per-item failure.
    /// </summary>
    protected abstract Task RunCycleAsync(CancellationToken ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                await RunCycleSafelyAsync(stoppingToken);
                await Task.Delay(Interval, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down; not an error.
        }
    }

    private async Task RunCycleSafelyAsync(CancellationToken stoppingToken)
    {
        try
        {
            await RunCycleAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "{Job} cycle failed", GetType().Name);
        }
    }
}
