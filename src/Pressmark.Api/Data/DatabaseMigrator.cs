using Microsoft.EntityFrameworkCore;

namespace Pressmark.Api.Data;

/// <summary>
/// Applies pending EF Core migrations at startup.
/// </summary>
/// <remarks>
/// The API and the database come up together under Docker Compose, so the first
/// few attempts routinely fail while the database container is still starting.
/// Those are retried; anything still failing after <see cref="MaxAttempts"/> is a
/// real problem and is allowed to bring the host down rather than leaving it
/// serving requests against a schema that was never migrated.
/// </remarks>
internal static class DatabaseMigrator
{
    private const int MaxAttempts = 10;
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(3);

    internal static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await db.Database.MigrateAsync();
                return;
            }
            catch (Exception ex) when (attempt < MaxAttempts)
            {
                logger.LogWarning(
                    "DB not ready (attempt {Attempt}/{MaxAttempts}): {Message}. Retrying in {Delay}s…",
                    attempt, MaxAttempts, ex.Message, RetryDelay.TotalSeconds);
                await Task.Delay(RetryDelay);
            }
        }
    }
}
