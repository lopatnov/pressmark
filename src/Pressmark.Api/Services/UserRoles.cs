namespace Pressmark.Api.Services;

/// <summary>The two role values stored in <c>User.Role</c> and used in <c>[Authorize(Roles = ...)]</c>.</summary>
internal static class UserRoles
{
    internal const string Admin = "Admin";
    internal const string User = "User";
}
