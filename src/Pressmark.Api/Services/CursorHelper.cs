using System.Text;

namespace Pressmark.Api.Services;

internal static class CursorHelper
{
    internal static string Encode(DateTime publishedAt, Guid id)
        => Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{publishedAt.Ticks}|{id}"));

    internal static bool TryParse(string cursor, out DateTime date, out Guid id)
    {
        date = default;
        id = default;
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            var parts = raw.Split('|');
            if (parts.Length != 2) return false;
            if (!long.TryParse(parts[0], out var ticks)) return false;
            if (ticks < DateTime.MinValue.Ticks || ticks > DateTime.MaxValue.Ticks) return false;
            date = new DateTime(ticks, DateTimeKind.Utc);
            id = Guid.Parse(parts[1]);
            return true;
        }
        catch { return false; }
    }
}
