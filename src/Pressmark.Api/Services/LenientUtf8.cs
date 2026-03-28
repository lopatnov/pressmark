using System.Text;
using System.Text.RegularExpressions;

namespace Pressmark.Api.Services;

/// <summary>
/// Helpers for tolerant RSS/Atom feed decoding.
/// Handles common issues in real-world feeds:
///   1. Invalid UTF-8 byte sequences → replaced with U+FFFD.
///   2. Bare '&amp;' in URLs/text (e.g. href="page?a=1&amp;b=2") → escaped to &amp;amp;
///   3. Undeclared namespace prefixes (e.g. &lt;himalayasJobs:field&gt;) → dummy xmlns injected.
/// </summary>
internal static class LenientUtf8
{
    private static readonly Encoding Utf8Lenient =
        new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false);

    // & not followed by a valid entity reference (#123; or #x1F; or name;)
    private static readonly Regex BareAmpersand = new(
        @"&(?!(?:#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)",
        RegexOptions.Compiled);

    private static readonly Regex DeclaredPrefix = new(@"xmlns:([a-zA-Z]\w*)", RegexOptions.Compiled);
    private static readonly Regex UsedPrefix     = new(@"</?([a-zA-Z]\w*):[a-zA-Z\w]", RegexOptions.Compiled);
    private static readonly Regex FirstElement   = new(@"(<[a-zA-Z][^>]*)(>)", RegexOptions.Compiled);

    public static string GetString(byte[] bytes)
    {
        var xml = Utf8Lenient.GetString(bytes);
        xml = BareAmpersand.Replace(xml, "&amp;");
        xml = FixUndeclaredPrefixes(xml);
        return xml;
    }

    private static string FixUndeclaredPrefixes(string xml)
    {
        var declared = new HashSet<string>(DeclaredPrefix.Matches(xml).Select(m => m.Groups[1].Value))
            { "xml", "xmlns" };

        var used = new HashSet<string>(UsedPrefix.Matches(xml).Select(m => m.Groups[1].Value));

        var missing = used.Except(declared).ToList();
        if (missing.Count == 0) return xml;

        var declarations = string.Join(" ", missing.Select(p => $"xmlns:{p}=\"urn:feed:{p}\""));

        // Inject into the root element's opening tag only (first match)
        var injected = false;
        return FirstElement.Replace(xml, m =>
        {
            if (injected) return m.Value;
            injected = true;
            return m.Groups[1].Value + " " + declarations + m.Groups[2].Value;
        });
    }
}
