using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Tests;

public class MigrationTests
{
    /// <summary>
    /// Applies all EF Core migrations to a fresh database and verifies no pending migrations remain.
    /// Requires TEST_MSSQL_CONNECTION_STRING env var — set in CI via MSSQL service container,
    /// skipped silently in local runs without SQL Server.
    /// </summary>
    [Fact]
    public async Task Migrations_ApplyCleanly_ToEmptyDatabase()
    {
        var connectionString = Environment.GetEnvironmentVariable("TEST_MSSQL_CONNECTION_STRING");
        if (string.IsNullOrEmpty(connectionString))
            return;

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        await using var context = new AppDbContext(options);
        try
        {
            await context.Database.MigrateAsync();

            var pending = (await context.Database.GetPendingMigrationsAsync()).ToList();
            Assert.Empty(pending);

            var applied = (await context.Database.GetAppliedMigrationsAsync()).ToList();
            Assert.NotEmpty(applied);
        }
        finally
        {
            await context.Database.EnsureDeletedAsync();
        }
    }
}
