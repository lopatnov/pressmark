namespace Pressmark.Api.Services;

/// <summary>
/// Page size limits shared by every paginated list endpoint, offset- or
/// keyset-based alike, so the two pagination strategies can't drift apart.
/// </summary>
internal static class PagingDefaults
{
    internal const int DefaultPageSize = 20;
    internal const int MaxPageSize = 100;
}
