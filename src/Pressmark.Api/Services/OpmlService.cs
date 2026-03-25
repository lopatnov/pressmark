using System.Text;
using System.Xml.Linq;
using Pressmark.Api.Entities;

namespace Pressmark.Api.Services;

public static class OpmlService
{
    public static List<(string RssUrl, string Title)> Parse(string opml)
    {
        var doc = XDocument.Parse(opml);
        return doc.Descendants("outline")
            .Where(e => !string.IsNullOrEmpty(e.Attribute("xmlUrl")?.Value))
            .Select(e => (
                RssUrl: e.Attribute("xmlUrl")!.Value.Trim(),
                Title:  e.Attribute("text")?.Value.Trim()
                        ?? e.Attribute("title")?.Value.Trim()
                        ?? e.Attribute("xmlUrl")!.Value.Trim()
            ))
            .Where(x => Uri.TryCreate(x.RssUrl, UriKind.Absolute, out var u)
                        && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps))
            .ToList();
    }

    public static string Generate(IEnumerable<Subscription> subscriptions)
    {
        var body = new XElement("body",
            subscriptions.Select(s => new XElement("outline",
                new XAttribute("type",   "rss"),
                new XAttribute("text",   s.Title),
                new XAttribute("title",  s.Title),
                new XAttribute("xmlUrl", s.RssUrl)
            ))
        );

        var doc = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement("opml",
                new XAttribute("version", "2.0"),
                new XElement("head",
                    new XElement("title", "Pressmark subscriptions")
                ),
                body
            )
        );

        var sb = new StringBuilder();
        using var writer = new System.IO.StringWriter(sb);
        doc.Save(writer);
        return sb.ToString();
    }
}
