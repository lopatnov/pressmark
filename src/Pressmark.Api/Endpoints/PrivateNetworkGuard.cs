namespace Pressmark.Api.Endpoints;

/// <summary>
/// Decides whether a URL the server was asked to fetch on a caller's behalf points
/// somewhere only the server can reach — loopback or a private range. Used by the
/// favicon proxy, the one endpoint that fetches a URL the caller chooses.
/// </summary>
internal static class PrivateNetworkGuard
{
    /// <summary>Whether the proxy must refuse to fetch from this URL's host.</summary>
    internal static bool IsBlocked(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        return host is "localhost" or "127.0.0.1" or "::1"
            || host.StartsWith("192.168.")
            || host.StartsWith("10.")
            || host.StartsWith("169.254.")
            || IsPrivate172(host);
    }

    private static bool IsPrivate172(string host)
    {
        if (!host.StartsWith("172.")) return false;
        var parts = host.Split('.');
        return parts.Length >= 2 && int.TryParse(parts[1], out var octet) && octet is >= 16 and <= 31;
    }
}
