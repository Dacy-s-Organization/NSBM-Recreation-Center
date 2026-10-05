using System.Text.RegularExpressions;

namespace RecCenter.Core.Domain;

/// <summary>Batch names typed by the user. Trimmed, with internal whitespace collapsed.</summary>
public static partial class BatchName
{
    public const int MaxLength = 40;

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    public static string Key(string? value) => Whitespace().Replace((value ?? "").Trim(), " ").ToLowerInvariant();

    /// <returns>The name, or null when <paramref name="error"/> is set.</returns>
    public static string? Normalize(string? value, out string? error)
    {
        var name = Whitespace().Replace((value ?? "").Trim(), " ");
        if (name.Length == 0)
        {
            error = "Enter a batch name.";
            return null;
        }
        if (name.Length > MaxLength)
        {
            error = "Batch name must be 40 characters or fewer.";
            return null;
        }
        error = null;
        return name;
    }

    public static bool Same(string? a, string? b)
    {
        var left = Key(a);
        var right = Key(b);
        return left.Length > 0 && left == right;
    }
}
