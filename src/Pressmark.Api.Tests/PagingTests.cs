using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

/// <summary>
/// The clamps every list endpoint relies on: they are the only thing standing between
/// a client-supplied page size and an unbounded query, and the page ceiling exists to
/// stop page * pageSize overflowing into the negative offset SQL Server rejects.
/// </summary>
public class PagingTests
{
    // ── AdminPaging.Normalize (offset pagination) ─────────────────────────────

    [Fact]
    public void Normalize_UnsetPageSize_UsesDefault()
    {
        var (page, pageSize) = AdminPaging.Normalize(0, 0);

        Assert.Equal(0, page);
        Assert.Equal(PagingDefaults.DefaultPageSize, pageSize);
    }

    [Fact]
    public void Normalize_OversizedPageSize_ClampedToMax()
    {
        var (_, pageSize) = AdminPaging.Normalize(0, PagingDefaults.MaxPageSize + 1_000);

        Assert.Equal(PagingDefaults.MaxPageSize, pageSize);
    }

    [Fact]
    public void Normalize_NegativePage_ClampedToFirstPage()
    {
        var (page, _) = AdminPaging.Normalize(-5, 10);

        Assert.Equal(0, page);
    }

    [Fact]
    public void Normalize_HugePage_StaysWithinOffsetRange()
    {
        // The offset the caller then computes must remain a positive int for any
        // page size the same call is allowed to return.
        var (page, pageSize) = AdminPaging.Normalize(int.MaxValue, PagingDefaults.MaxPageSize);

        Assert.Equal(PagingDefaults.MaxPageSize, pageSize);
        Assert.True((long)page * pageSize <= int.MaxValue,
            $"page {page} * pageSize {pageSize} overflows a positive offset");
    }

    [Fact]
    public void ToPage_AppliesTheOffsetWindow()
    {
        var source = Enumerable.Range(0, 100).AsQueryable();

        var second = source.ToPage(page: 1, pageSize: 20).ToList();

        Assert.Equal(20, second.Count);
        Assert.Equal(20, second[0]);
        Assert.Equal(39, second[^1]);
    }

    // ── FeedQueryExtensions.ClampPageSize (keyset pagination) ─────────────────

    [Fact]
    public void ClampPageSize_Zero_UsesDefault()
    {
        Assert.Equal(PagingDefaults.DefaultPageSize, FeedQueryExtensions.ClampPageSize(0));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(int.MinValue)]
    public void ClampPageSize_Negative_ClampedToOne(int requested)
    {
        Assert.Equal(1, FeedQueryExtensions.ClampPageSize(requested));
    }

    [Fact]
    public void ClampPageSize_Oversized_ClampedToMax()
    {
        Assert.Equal(PagingDefaults.MaxPageSize, FeedQueryExtensions.ClampPageSize(int.MaxValue));
    }

    [Fact]
    public void ClampPageSize_WithinRange_PassesThrough()
    {
        Assert.Equal(37, FeedQueryExtensions.ClampPageSize(37));
    }
}
