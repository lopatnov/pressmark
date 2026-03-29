using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Tests;

public class MigrationTests
{
    /// <summary>
    /// Applies all EF Core migrations to a fresh, uniquely-named database and verifies
    /// no pending migrations remain. The temp DB is always deleted in the finally block,
    /// so this test never touches an existing database even if TEST_MSSQL_CONNECTION_STRING
    /// points to one.
    /// Requires TEST_MSSQL_CONNECTION_STRING env var — set in CI via MSSQL service container,
    /// skipped silently in local runs without SQL Server.
    /// </summary>
    [Fact]
    public async Task Migrations_ApplyCleanly_ToEmptyDatabase()
    {
        var raw = Environment.GetEnvironmentVariable("TEST_MSSQL_CONNECTION_STRING");
        if (string.IsNullOrEmpty(raw))
            return;

        // Use a unique catalog so we never wipe an existing database.
        var connectionString = new SqlConnectionStringBuilder(raw)
        {
            InitialCatalog = $"pressmark_migrations_{Guid.NewGuid():N}",
        }.ConnectionString;

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
