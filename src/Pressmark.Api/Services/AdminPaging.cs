namespace Pressmark.Api.Services;

/// <summary>
/// Offset pagination shared by the admin list endpoints, which all expose the
/// same page/page_size request fields and a total count in the response.
/// </summary>
internal static class AdminPaging
{
    /// <summary>
    /// Clamps a client-supplied page and page size to the supported range.
    /// A page size of zero (unset) means the default.
    /// </summary>
    /// <remarks>
    /// The page is bounded above as well as below: <see cref="ToPage{T}"/> multiplies it by
    /// the page size, and an unbounded page overflows that product to a negative offset
    /// that the SQL Server provider rejects. The ceiling keeps the largest permitted page
    /// size in range.
    /// </remarks>
    internal static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Clamp(page, 0, int.MaxValue / Math.Max(1, PagingDefaults.MaxPageSize)),
         pageSize > 0 ? Math.Min(pageSize, PagingDefaults.MaxPageSize) : PagingDefaults.DefaultPageSize);

    /// <summary>Applies the offset window for the given normalised page.</summary>
    internal static IQueryable<T> ToPage<T>(this IQueryable<T> query, int page, int pageSize) =>
        query.Skip(page * pageSize).Take(pageSize);
}
