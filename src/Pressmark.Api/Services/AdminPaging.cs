namespace Pressmark.Api.Services;

/// <summary>
/// Offset pagination shared by the admin list endpoints, which all expose the
/// same page/page_size request fields and a total count in the response.
/// </summary>
internal static class AdminPaging
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    /// <summary>
    /// Clamps a client-supplied page and page size to the supported range.
    /// A page size of zero (unset) means the default.
    /// </summary>
    internal static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(0, page),
         pageSize > 0 ? Math.Min(pageSize, MaxPageSize) : DefaultPageSize);

    /// <summary>Applies the offset window for the given normalised page.</summary>
    internal static IQueryable<T> ToPage<T>(this IQueryable<T> query, int page, int pageSize) =>
        query.Skip(page * pageSize).Take(pageSize);
}
