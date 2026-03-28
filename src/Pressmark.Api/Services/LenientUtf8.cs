using System.Text;
using System.Text.RegularExpressions;

namespace Pressmark.Api.Services;

/// <summary>
/// Helpers for tolerant RSS/Atom feed decoding.
/// Handles two common issues in real-world feeds:
///   1. Invalid UTF-8 byte sequences (decoded as U+FFFD instead of throwing or producing surrogates).
///   2. Bare '&amp;' characters in URLs/text that are not valid XML entity references
///      (e.g. href="page?a=1&amp;b=2" instead of href="page?a=1&amp;amp;b=2").
/// </summary>
internal static class LenientUtf8
{
    private static readonly Encoding Utf8Lenient =
        new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false);

    // Matches '&' NOT followed by a valid XML entity reference:
    //   &#123;   — decimal numeric reference
    //   &#x1F;   — hex numeric reference
    //   &amp;    — named reference (any word chars followed by ';')
    private static readonly Regex BareAmpersand = new(
        @"&(?!(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)",
        RegexOptions.Compiled);

    public static string GetString(byte[] bytes)
    {
        var xml = Utf8Lenient.GetString(bytes);
        return BareAmpersand.Replace(xml, "&amp;");
    }
}
