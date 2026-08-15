using System.Net;
using System.Net.Sockets;

namespace Pressmark.Api.Endpoints;

/// <summary>
/// Decides whether a URL the server was asked to fetch on a caller's behalf points
/// somewhere only the server can reach — loopback, a private or link-local range,
/// or the cloud metadata address. Used by the favicon proxy, the one endpoint that
/// fetches a URL the caller chooses.
/// </summary>
/// <remarks>
/// The decision is made on the parsed <see cref="IPAddress"/> rather than on the
/// host string, because prefix matching misses every form a textual host can take
/// once it is not a plain dotted quad. <see cref="Uri.Host"/> hands back an IPv6
/// literal with its brackets ("[::1]"), so comparing against "::1" never fires; and
/// a string test says nothing about IPv4-mapped IPv6, "0.0.0.0", or IPv6
/// unique-local addresses. Parsing normalises all of those into one check.
/// <para>
/// Out of scope: a hostname that <em>resolves</em> to a private address. Covering it
/// takes DNS resolution plus pinning the connection to the address that was checked,
/// otherwise the answer can change between the check and the fetch.
/// </para>
/// </remarks>
internal static class PrivateNetworkGuard
{
    /// <summary>Whether the proxy must refuse to fetch from this URL's host.</summary>
    internal static bool IsBlocked(Uri uri)
    {
        // Uri.Host keeps the square brackets around an IPv6 literal.
        var host = uri.Host.Trim('[', ']');

        if (IPAddress.TryParse(host, out var address))
            return IsBlockedAddress(address);

        // Not a literal. Without resolving it, only the names that always mean
        // "this machine" can be ruled out.
        var name = host.TrimEnd('.').ToLowerInvariant();
        return name is "localhost" || name.EndsWith(".localhost");
    }

    /// <summary>Whether an address belongs to a range the proxy must not reach.</summary>
    internal static bool IsBlockedAddress(IPAddress address)
    {
        // ::ffff:127.0.0.1 is the loopback address wearing an IPv6 costume.
        var ip = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;

        if (IPAddress.IsLoopback(ip)) return true;

        return ip.AddressFamily switch
        {
            AddressFamily.InterNetwork => IsBlockedV4(ip),
            AddressFamily.InterNetworkV6 => IsBlockedV6(ip),
            _ => true, // an address family the proxy has no business reaching
        };
    }

    private static bool IsBlockedV4(IPAddress ip)
    {
        var b = ip.GetAddressBytes();
        return b[0] switch
        {
            0 => true,                       // 0.0.0.0/8 — "this network", routes to local
            10 => true,                      // 10.0.0.0/8
            127 => true,                     // 127.0.0.0/8 loopback
            100 => b[1] is >= 64 and <= 127, // 100.64.0.0/10 carrier-grade NAT
            169 => b[1] == 254,              // 169.254.0.0/16 link-local, incl. cloud metadata
            172 => b[1] is >= 16 and <= 31,  // 172.16.0.0/12
            192 => b[1] == 168,              // 192.168.0.0/16
            >= 224 => true,                  // multicast and reserved
            _ => false,
        };
    }

    private static bool IsBlockedV6(IPAddress ip) =>
        ip.IsIPv6LinkLocal
        || ip.IsIPv6SiteLocal
        || ip.IsIPv6UniqueLocal
        || ip.IsIPv6Multicast
        || ip.Equals(IPAddress.IPv6Any);
}
