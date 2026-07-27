namespace Pressmark.Api.Services;

/// <summary>
/// The two kinds of content a user can report, stored in <c>Report.Type</c>.
/// Part of the wire contract: the client sends these values verbatim.
/// </summary>
internal static class ReportTypes
{
    internal const string Comment = "comment";
    internal const string Subscription = "subscription";
}
