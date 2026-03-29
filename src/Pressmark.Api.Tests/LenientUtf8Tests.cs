using Pressmark.Api.Services;

namespace Pressmark.Api.Tests;

public class LenientUtf8Tests
{
    [Fact]
    public void GetString_InvalidUtf8Bytes_ReplacedWithReplacementChar()
    {
        // 0xFF is not valid UTF-8
        var bytes = new byte[] { (byte)'<', (byte)'r', (byte)'>', 0xFF, (byte)'<', (byte)'/', (byte)'r', (byte)'>' };
        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("\uFFFD", result);
        Assert.DoesNotContain("?", result); // should use replacement char, not question mark
    }

    [Fact]
    public void GetString_BareAmpersand_EscapedToAmpAmp()
    {
        var xml = "<r><a href=\"page?a=1&b=2\">text</a></r>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("&amp;b=2", result);
        Assert.DoesNotContain("a=1&b", result); // bare & must be gone
    }

    [Fact]
    public void GetString_ValidEntityRef_NotDoubleEscaped()
    {
        // &amp; is already a valid entity — must not become &amp;amp;
        var xml = "<r><a>good &amp; done</a></r>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("&amp;", result);
        Assert.DoesNotContain("&amp;amp;", result);
    }

    [Fact]
    public void GetString_NumericEntityRef_NotEscaped()
    {
        // &#160; and &#x00A0; are valid numeric references
        var xml = "<r>a&#160;b&#x00A0;c</r>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("&#160;", result);
        Assert.Contains("&#x00A0;", result);
        Assert.DoesNotContain("&amp;#", result);
    }

    [Fact]
    public void GetString_UndeclaredNamespacePrefix_DummyXmlnsInjected()
    {
        var xml = "<rss><himalayasJobs:field>value</himalayasJobs:field></rss>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("xmlns:himalayasJobs=", result);
    }

    [Fact]
    public void GetString_DeclaredPrefix_NotDuplicated()
    {
        var xml = "<rss xmlns:media=\"http://search.yahoo.com/mrss/\"><media:content/></rss>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        // Only one declaration should be present
        var count = CountOccurrences(result, "xmlns:media=");
        Assert.Equal(1, count);
    }

    [Fact]
    public void GetString_ValidUtf8_PassesThrough()
    {
        var xml = "<rss><title>Hello World</title></rss>";
        var bytes = System.Text.Encoding.UTF8.GetBytes(xml);

        var result = LenientUtf8.GetString(bytes);

        Assert.Contains("Hello World", result);
    }

    private static int CountOccurrences(string source, string value)
    {
        var count = 0;
        var idx = 0;
        while ((idx = source.IndexOf(value, idx, StringComparison.Ordinal)) >= 0)
        {
            count++;
            idx += value.Length;
        }

        return count;
    }
}
