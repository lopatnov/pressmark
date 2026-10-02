namespace Pressmark.Api.Services;

/// <summary>
/// The values of the <c>registration_mode</c> site setting. Part of the wire contract:
/// the admin screen sends these verbatim. Any other stored value closes registration.
/// </summary>
internal static class RegistrationModes
{
    internal const string Open = "open";
    internal const string InviteOnly = "invite_only";
}
