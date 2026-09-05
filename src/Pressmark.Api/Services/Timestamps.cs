namespace Pressmark.Api.Services;

/// <summary>
/// Serialises stored timestamps for the wire. Every <see cref="DateTime"/> this app
/// persists is UTC (written as <c>DateTime.UtcNow</c> or <c>.UtcDateTime</c>), so the
/// mappers go through here rather than formatting a <see cref="DateTime"/> directly.
/// </summary>
internal static class Timestamps
{
    /// <summary>
    /// Formats a stored timestamp as round-trippable UTC, trailing <c>Z</c> included.
    /// </summary>
    /// <remarks>
    /// SQL Server's <c>datetime2</c> carries no zone, so EF Core hands the value back as
    /// <see cref="DateTimeKind.Unspecified"/> and the "O" specifier then omits the <c>Z</c>.
    /// A browser reads an ISO-8601 date-time without a zone as *local* time, which rendered
    /// every stored timestamp shifted by the viewer's UTC offset — and disagreeing with the
    /// same instant pushed over the update stream, whose value is still
    /// <see cref="DateTimeKind.Utc"/> and so kept its <c>Z</c>. Pinning the kind before
    /// formatting is what makes the two agree; it is a no-op on a value already marked UTC.
    /// </remarks>
    internal static string ToIsoUtc(this DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Utc).ToString("O");

    /// <summary>
    /// As <see cref="ToIsoUtc(DateTime)"/>, mapping "no value" onto the empty string the
    /// proto contracts use for an absent timestamp.
    /// </summary>
    internal static string ToIsoUtc(this DateTime? value) =>
        value?.ToIsoUtc() ?? "";
}
