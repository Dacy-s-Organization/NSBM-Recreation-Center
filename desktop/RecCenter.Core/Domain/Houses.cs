using RecCenter.Core.Models;

namespace RecCenter.Core.Domain;

/// <summary>Recreation center house names and CSV/import aliases.</summary>
public static class Houses
{
    public static readonly string[] Names = { "Ruby", "Citrine", "Emerald", "Sapphire" };

    private static readonly Dictionary<string, string> LegacyAliases = new()
    {
        ["ruby adventurers"] = "Ruby",
        ["citrine warriors"] = "Citrine",
        ["emerald fighters"] = "Emerald",
        ["sapphire heroes"] = "Sapphire",
    };

    public static string? ResolveName(string input)
    {
        var value = input.Trim().ToLowerInvariant();
        if (value.Length == 0) return null;

        var exact = Names.FirstOrDefault(n => n.ToLowerInvariant() == value);
        if (exact is not null) return exact;

        if (LegacyAliases.TryGetValue(value, out var alias)) return alias;

        return Names.FirstOrDefault(n => value.StartsWith(n.ToLowerInvariant(), StringComparison.Ordinal));
    }

    public static Dictionary<string, string> BuildIdMap(IEnumerable<House> houses)
    {
        var map = new Dictionary<string, string>();
        foreach (var house in houses)
        {
            var canonical = ResolveName(house.Name) ?? house.Name;
            map[canonical.ToLowerInvariant()] = house.Id;
            map[house.Name.ToLowerInvariant()] = house.Id;
        }
        return map;
    }

    public static string? LookupId(string houseName, Dictionary<string, string> map)
    {
        var canonical = ResolveName(houseName);
        if (canonical is null) return null;
        return map.TryGetValue(canonical.ToLowerInvariant(), out var id) ? id : null;
    }
}
