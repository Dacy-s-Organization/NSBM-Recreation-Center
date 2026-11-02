namespace RecCenter.Core.Domain;

public static class CsvText
{
    public static string Build(IEnumerable<string> headers, IEnumerable<IEnumerable<string?>> rows)
    {
        var lines = new List<string> { Line(headers) };
        foreach (var row in rows) lines.Add(Line(row));
        return "\uFEFF" + string.Join("\r\n", lines);
    }

    public static string FileSlug(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "all";
        var chars = value.Trim().ToLowerInvariant().Select(ch =>
            char.IsLetterOrDigit(ch) || ch == '.' ? ch : '-').ToArray();
        var slug = new string(chars).Trim('-');
        while (slug.Contains("--", StringComparison.Ordinal)) slug = slug.Replace("--", "-", StringComparison.Ordinal);
        return slug.Length == 0 ? "all" : slug;
    }

    public static string Blank(string? value)
    {
        var text = value?.Trim() ?? "";
        return text == "—" ? "" : text;
    }

    private static string Line(IEnumerable<string?> cells) => string.Join(",", cells.Select(Escape));

    private static string Escape(string? value)
    {
        var text = value ?? "";
        if (text.Length > 0 && "=+-@\t\r".Contains(text[0])) text = "'" + text;
        if (text.Contains('"') || text.Contains(',') || text.Contains('\n') || text.Contains('\r'))
            return "\"" + text.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";
        return text;
    }
}
