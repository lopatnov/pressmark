using System.Net;
using Pressmark.Api.Endpoints;

namespace Pressmark.Api.Tests;

/// <summary>
/// Unit tests for the favicon-proxy SSRF defenses. <see cref="SsrfGuard.IsPublicAddress"/>
/// is the enforcement point every resolved address must pass — these tests cover the
/// address families/ranges called out in the fix: loopback, link-local (incl. the cloud
/// metadata address), RFC1918 private ranges, CGNAT, the unspecified address, IPv6
/// unique-local/site-local/multicast, and IPv4-mapped-IPv6 variants of both blocked and
/// allowed addresses.
/// </summary>
public class SsrfGuardTests
{
    [Theory]
    // Loopback
    [InlineData("127.0.0.1")]
    [InlineData("127.255.255.254")]
    [InlineData("::1")]
    [InlineData("::ffff:127.0.0.1")] // IPv4-mapped IPv6 loopback
    // Unspecified / "any"
    [InlineData("0.0.0.0")]
    [InlineData("::")]
    [InlineData("0.1.2.3")] // 0.0.0.0/8 "this network"
    // Link-local, including the cloud metadata address
    [InlineData("169.254.169.254")]
    [InlineData("169.254.0.1")]
    [InlineData("fe80::1")]
    // RFC1918 private ranges
    [InlineData("10.0.0.1")]
    [InlineData("10.255.255.255")]
    [InlineData("172.16.0.1")]
    [InlineData("172.31.255.255")]
    [InlineData("192.168.0.1")]
    [InlineData("192.168.255.255")]
    // Carrier-grade NAT (RFC 6598)
    [InlineData("100.64.0.1")]
    [InlineData("100.127.255.255")]
    // IPv6 unique-local (ULA, RFC 4193) and deprecated site-local
    [InlineData("fc00::1")]
    [InlineData("fd12:3456:789a::1")]
    [InlineData("fec0::1")]
    // Multicast / reserved
    [InlineData("224.0.0.1")]
    [InlineData("239.255.255.255")]
    [InlineData("240.0.0.1")]
    [InlineData("ff02::1")]
    // IPv4-mapped IPv6 wrapping a blocked address must still be blocked
    [InlineData("::ffff:10.0.0.1")]
    [InlineData("::ffff:169.254.169.254")]
    [InlineData("::ffff:192.168.1.1")]
    public void IsPublicAddress_BlockedRanges_ReturnsFalse(string ip)
    {
        var address = IPAddress.Parse(ip);

        Assert.False(SsrfGuard.IsPublicAddress(address));
    }

    [Theory]
    // Public IPv4
    [InlineData("8.8.8.8")]
    [InlineData("1.1.1.1")]
    [InlineData("93.184.216.34")]
    // Just outside the RFC1918 172.16.0.0/12 range
    [InlineData("172.15.255.255")]
    [InlineData("172.32.0.1")]
    // Just outside the CGNAT range
    [InlineData("100.63.255.255")]
    [InlineData("100.128.0.1")]
    // Public IPv6 (global unicast)
    [InlineData("2606:4700:4700::1111")]
    [InlineData("2001:4860:4860::8888")]
    // IPv4-mapped IPv6 wrapping a public address
    [InlineData("::ffff:8.8.8.8")]
    public void IsPublicAddress_PublicAddresses_ReturnsTrue(string ip)
    {
        var address = IPAddress.Parse(ip);

        Assert.True(SsrfGuard.IsPublicAddress(address));
    }

    [Fact]
    public void CreateHandler_DisablesAutomaticRedirects()
    {
        // A public, allowed host could otherwise 302 to a blocked target and slip past
        // the SSRF check performed for the original request URL.
        using var handler = FaviconProxyEndpoint.CreateHandler();

        Assert.False(handler.AllowAutoRedirect);
    }

    [Fact]
    public void CreateHandler_RoutesConnectsThroughSsrfGuard()
    {
        // Every socket connect (not just a pre-check of the original URL) must be
        // validated, so DNS-rebinding between check-time and connect-time can't bypass it.
        // Compared by MethodInfo rather than Assert.Same: method-group-to-delegate
        // conversion caches per call site, so two independent conversions of the same
        // static method are equal-but-distinct delegate instances.
        using var handler = FaviconProxyEndpoint.CreateHandler();

        Assert.NotNull(handler.ConnectCallback);
        Assert.Equal(
            ((Delegate)SsrfGuard.ConnectAsync).Method,
            handler.ConnectCallback.Method);
    }
}
