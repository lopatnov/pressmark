using Microsoft.Extensions.Logging;
using Pressmark.Api.BackgroundServices;

namespace Pressmark.Api.Tests;

/// <summary>
/// The scheduled jobs rely on the shared loop for two guarantees: one failed cycle must
/// not stop the job (or, by escaping ExecuteAsync, the host), and a shutdown must not be
/// reported as a failure.
/// </summary>
public class PeriodicBackgroundServiceTests
{
    private static readonly TimeSpan WaitLimit = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task AFailedCycle_IsLogged_AndTheNextCycleStillRuns()
    {
        var logger = new RecordingLogger();
        var secondCycle = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var cycles = 0;
        var job = new TestJob(logger, _ =>
        {
            if (++cycles == 1) throw new InvalidOperationException("transient");
            secondCycle.TrySetResult();
            return Task.CompletedTask;
        });

        await job.StartAsync(CancellationToken.None);
        await secondCycle.Task.WaitAsync(WaitLimit);
        await job.StopAsync(CancellationToken.None);

        Assert.Single(logger.Errors);
        Assert.True(job.ExecuteTask!.IsCompletedSuccessfully);
    }

    [Fact]
    public async Task StoppingDuringACycle_EndsQuietly()
    {
        var logger = new RecordingLogger();
        var cycleStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var job = new TestJob(logger, async ct =>
        {
            cycleStarted.TrySetResult();
            await Task.Delay(Timeout.Infinite, ct);
        });

        await job.StartAsync(CancellationToken.None);
        await cycleStarted.Task.WaitAsync(WaitLimit);
        await job.StopAsync(CancellationToken.None);

        Assert.Empty(logger.Errors);
        Assert.True(job.ExecuteTask!.IsCompletedSuccessfully);
    }

    private sealed class TestJob(ILogger logger, Func<CancellationToken, Task> cycle)
        : PeriodicBackgroundService(logger)
    {
        protected override TimeSpan InitialDelay => TimeSpan.Zero;

        protected override TimeSpan Interval => TimeSpan.FromMilliseconds(1);

        protected override Task RunCycleAsync(CancellationToken ct) => cycle(ct);
    }

    private sealed class RecordingLogger : ILogger
    {
        private readonly List<string> _errors = [];

        public IReadOnlyList<string> Errors
        {
            get { lock (_errors) return [.. _errors]; }
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (logLevel < LogLevel.Error) return;
            lock (_errors) _errors.Add(formatter(state, exception));
        }
    }
}
