using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Pressmark.Api.Data;

namespace Pressmark.Api.Tests;

/// <summary>
/// Creates a dedicated MSSQL database for one test class, applies all migrations,
/// and drops the database on disposal. Skipped silently when
/// TEST_MSSQL_CONNECTION_STRING is not set (local dev without SQL Server).
/// </summary>
public sealed class IntegrationFixture : IAsyncLifetime
{
    private string? _connectionString;

    public bool IsAvailable => _connectionString is not null;

    public AppDbContext CreateContext()
    {
        if (_connectionString is null)
            throw new InvalidOperationException("SQL Server not available");

        return new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(_connectionString)
                .Options);
    }

    public async Task InitializeAsync()
    {
        var raw = Environment.GetEnvironmentVariable("TEST_MSSQL_CONNECTION_STRING");
        if (string.IsNullOrEmpty(raw))
            return;

        var sb = new SqlConnectionStringBuilder(raw)
        {
            InitialCatalog = $"pressmark_it_{Guid.NewGuid():N}",
        };
        _connectionString = sb.ConnectionString;

        await using var ctx = CreateContext();
        await ctx.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_connectionString is null)
            return;

        await using var ctx = CreateContext();
        await ctx.Database.EnsureDeletedAsync();
    }
}
