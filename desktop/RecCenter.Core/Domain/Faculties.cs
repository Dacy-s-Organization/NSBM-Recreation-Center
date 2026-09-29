namespace RecCenter.Core.Domain;

public sealed record NsbmFaculty(string Code, string Name, string Description);

/// <summary>NSBM Green University — four foundation faculties.</summary>
public static class Faculties
{
    public static readonly IReadOnlyList<NsbmFaculty> All = new[]
    {
        new NsbmFaculty("FOC", "Faculty of Computing", "Computing and IT programmes"),
        new NsbmFaculty("FOB", "Faculty of Business", "Business and management programmes"),
        new NsbmFaculty("FOE", "Faculty of Engineering", "Engineering programmes"),
        new NsbmFaculty("FOS", "Faculty of Sciences", "Science programmes"),
    };

    private static readonly Dictionary<string, string> Aliases = new()
    {
        ["FOSM"] = "FOS",
    };

    public static string NormalizeCode(string? code)
    {
        var trimmed = code?.Trim().ToUpperInvariant() ?? "";
        if (trimmed.Length == 0) return "";
        return Aliases.TryGetValue(trimmed, out var canonical) ? canonical : trimmed;
    }

    public static NsbmFaculty? GetByCode(string code)
    {
        var normalized = NormalizeCode(code);
        return All.FirstOrDefault(f => f.Code == normalized);
    }

    public static bool IsNsbmCode(string code) => GetByCode(code) is not null;

    /// <summary>Database codes stored for a faculty (FOS also covers legacy FOSM rows).</summary>
    public static string[] StoredCodes(string canonical) =>
        canonical == "FOS" ? new[] { "FOS", "FOSM" } : new[] { canonical };
}
