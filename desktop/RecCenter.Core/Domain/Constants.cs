using System.Globalization;
using RecCenter.Core.Models;

namespace RecCenter.Core.Domain;

public static class AchievementTypes
{
    public const string Champion = "Champion Team";
    public const string FirstPlace = "1st Place";
    public const string SecondPlace = "2nd Place";
    public const string ThirdPlace = "3rd Place";
    public const string BestPlayer = "Best Player";
    public const string NewSport = "__new__";
    public const string AthleticsSport = "Athletics";

    public static readonly string[] Other = { Champion, FirstPlace, SecondPlace, ThirdPlace, BestPlayer };
    public static readonly string[] Athletics = { FirstPlace, SecondPlace, ThirdPlace };

    /// <summary>Types accepted by the achievements CSV import, which only creates other-sport rows.</summary>
    public static readonly string[] All = Other;

    public static string? Parse(string raw) => Parse(raw, All);

    public static string? Parse(string raw, IReadOnlyList<string> allowed)
    {
        var t = raw.Trim();
        return allowed.Contains(t) ? t : null;
    }

    public static string[] ForCategory(string? category) =>
        category == "athletics" ? Athletics : Other;
}

public static class Formatting
{
    public static string TrackUnitLabel(string? unit)
    {
        var u = (unit ?? "").Trim().ToLowerInvariant();
        if (u == "s") return "seconds";
        if (u == "m") return "meters";
        var trimmed = (unit ?? "").Trim();
        return trimmed.Length > 0 ? trimmed : "value";
    }

    public static string RecordValue(double value, TrackRef? track)
    {
        var unit = track?.Unit?.Trim();
        var formatted = value == Math.Floor(value) && !double.IsInfinity(value)
            ? value.ToString("0", CultureInfo.InvariantCulture)
            : value.ToString("F2", CultureInfo.InvariantCulture);
        return string.IsNullOrEmpty(unit) ? formatted : $"{formatted} {unit}";
    }

    /// <summary>Matches JavaScript parseInt: leading integer digits, ignoring trailing text.</summary>
    public static int? ParseIntLoose(string? raw)
    {
        var s = (raw ?? "").Trim();
        var i = 0;
        if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
        var start = i;
        while (i < s.Length && char.IsAsciiDigit(s[i])) i++;
        if (i == start) return null;
        return int.TryParse(s[..i], NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    /// <summary>Matches JavaScript parseFloat: leading decimal number, ignoring trailing text.</summary>
    public static double? ParseFloatLoose(string? raw)
    {
        var s = (raw ?? "").Trim();
        var i = 0;
        if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
        var digits = 0;
        while (i < s.Length && char.IsAsciiDigit(s[i])) { i++; digits++; }
        if (i < s.Length && s[i] == '.')
        {
            i++;
            while (i < s.Length && char.IsAsciiDigit(s[i])) { i++; digits++; }
        }
        if (digits == 0) return null;
        if (i < s.Length && (s[i] == 'e' || s[i] == 'E'))
        {
            var j = i + 1;
            if (j < s.Length && (s[j] == '-' || s[j] == '+')) j++;
            var expStart = j;
            while (j < s.Length && char.IsAsciiDigit(s[j])) j++;
            if (j > expStart) i = j;
        }
        return double.TryParse(s[..i], NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : null;
    }
}
