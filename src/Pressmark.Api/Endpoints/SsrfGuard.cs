using System.Net;
using System.Net.Sockets;

namespace Pressmark.Api.Endpoints;

/// <summary>
/// SSRF defenses for endpoints that fetch a caller-supplied URL server-side (currently
/// only the favicon proxy, see <see cref="FaviconProxyEndpoint"/>).
///
/// Validation happens at TCP-connect time via <see cref="ConnectAsync"/> — wired in as
/// <c>SocketsHttpHandler.ConnectCallback</c> — rather than as a separate "resolve, check,
/// then let HttpClient fetch" step. A check-then-fetch approach would resolve the
/// hostname twice (once for the check, once when HttpClient actually connects); a
/// malicious/compromised DNS server can answer those two lookups differently (DNS
/// rebinding), returning a public address for the check and a private one moments later
/// for the real connection. Routing every connect attempt through this callback means
/// there is exactly one resolution, and the socket is opened directly against the
/// address that was just validated.
/// </summary>
internal static class SsrfGuard
{
    /// <summary>
    /// True when <paramref name="address"/> is safe for the server to connect to: not
    /// loopback, not link-local (including the 169.254.169.254 cloud metadata address),
    /// not RFC1918/CGNAT private space, not the unspecified/"any" address, and not an
    /// IPv6 unique-local/site-local/multicast address. IPv4-mapped IPv6 addresses
    /// (<c>::ffff:x.x.x.x</c>) are unwrapped first and classified by the embedded IPv4
    /// address, so a mapped private address (e.g. <c>::ffff:10.0.0.1</c>) is still blocked.
    /// </summary>
    internal static bool IsPublicAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        if (IPAddress.IsLoopback(address)) return false;
        if (address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any)) return false;
        if (address.IsIPv6LinkLocal || address.IsIPv6SiteLocal || address.IsIPv6UniqueLocal) return false;
        if (address.IsIPv6Multicast) return false;

        if (address.AddressFamily != AddressFamily.InterNetwork)
            return true; // any remaining address is a global-unicast IPv6 address

        var b = address.GetAddressBytes();
        return b[0] switch
        {
            0 => false, // 0.0.0.0/8 — "this network"
            10 => false, // 10.0.0.0/8 — RFC1918
            127 => false, // 127.0.0.0/8 — loopback (redundant with IsLoopback, kept explicit)
            169 when b[1] == 254 => false, // 169.254.0.0/16 — link-local, incl. cloud metadata
            172 when b[1] is >= 16 and <= 31 => false, // 172.16.0.0/12 — RFC1918
            192 when b[1] == 168 => false, // 192.168.0.0/16 — RFC1918
            100 when b[1] is >= 64 and <= 127 => false, // 100.64.0.0/10 — carrier-grade NAT
            >= 224 => false, // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
            _ => true,
        };
    }

    /// <summary>
    /// <see cref="SocketsHttpHandler.ConnectCallback"/> for the favicon-proxy HTTP client.
    /// Resolves every A/AAAA record for the target host and rejects the connection if ANY
    /// resolved address is non-public — not just the first one. A hostname that resolves
    /// to a mix of public and private addresses is treated as unsafe entirely, rather than
    /// connecting to "the safe one": an attacker controlling the DNS response can reorder
    /// records across requests, so picking the first "safe-looking" entry is not a
    /// dependable check on its own.
    /// </summary>
    internal static async ValueTask<Stream> ConnectAsync(
        SocketsHttpConnectionContext context, CancellationToken cancellationToken)
    {
        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new HttpRequestException($"DNS resolution failed for '{context.DnsEndPoint.Host}'.", ex);
        }

        if (addresses.Length == 0 || !addresses.All(IsPublicAddress))
            throw new HttpRequestException($"Blocked target address for host '{context.DnsEndPoint.Host}'.");

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses[0], context.DnsEndPoint.Port, cancellationToken);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }
}
