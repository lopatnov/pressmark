using System.Text;

namespace Pressmark.Api.Services;

/// <summary>
/// Decodes UTF-8 bytes replacing invalid sequences with the Unicode replacement character (U+FFFD)
/// instead of throwing or producing lone surrogates. Combined with XmlReaderSettings.CheckCharacters=false
/// this allows parsing RSS feeds that contain invalid UTF-8 byte sequences.
/// </summary>
internal static class LenientUtf8
{
    private static readonly Encoding Encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: false);

    public static string GetString(byte[] bytes) => Encoding.GetString(bytes);
}
