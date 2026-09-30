namespace RecCenter.Core.Domain;

public enum ImportType
{
    Students,
    Records,
    Inventory,
    Achievements,
}

public sealed class ImportPreviewRow
{
    public required Dictionary<string, string> Values { get; init; }
    public int Line { get; init; }
    public bool Valid { get; init; }
    public string? Error { get; init; }

    public string Get(string key) => Values.GetValueOrDefault(key) ?? "";
}

public sealed record ImportTemplate(string Filename, string Content, IReadOnlyList<string> Columns, IReadOnlyList<string>? ColumnLabels = null);

/// <summary>CSV import config per entity (port of lib/import-config.ts).</summary>
public static class ImportConfig
{
    public static readonly IReadOnlyDictionary<ImportType, string> Descriptions = new Dictionary<ImportType, string>
    {
        [ImportType.Students] =
            "Supports NSBM Foundation CSV (Serial No, Intake, Faculty, Student No / Student ID, …) or legacy columns. House is optional until assigned. Use Ruby, Citrine, Emerald, or Sapphire. Student No maps to student_id. Importing again fills only empty fields. Values already stored are kept.",
        [ImportType.Records] =
            "Columns: student_id, track_name, value, year. Students must exist before importing records.",
        [ImportType.Inventory] =
            "Columns: item_name, quantity. Existing items are updated by name.",
        [ImportType.Achievements] =
            "Required: meet_year, sport, achievement_type, team_name (house). Best Player requires winner_student_id. Other types may include winner_student_id. A sport that is not already listed is added. Types: Champion Team, Best Player.",
    };

    public static readonly IReadOnlyDictionary<ImportType, ImportTemplate> Templates = new Dictionary<ImportType, ImportTemplate>
    {
        [ImportType.Students] = new(
            "students_nsbm_template.csv",
            "Serial No,Intake,Faculty,Student No,Degree Programme,University,Title,Name with Initials,Gender,NIC/Passport,Mobile No,E-Mail\n574,2026.1,FOB,39706,Foundation Programme for Bachelor`s Degree - FOB,NSBM,Ms.,Sansala S H  R,Female,R-E008588,719341309,student@example.com",
            StudentColumns.All.Select(c => c.Key).Append("house_name").ToArray(),
            StudentColumns.All.Select(c => c.Label).Append("House").ToArray()),
        [ImportType.Records] = new(
            "records_template.csv",
            "student_id,track_name,value,year\n2024001,Long Jump,5.42,2024",
            new[] { "student_id", "track_name", "value", "year" }),
        [ImportType.Inventory] = new(
            "inventory_template.csv",
            "item_name,quantity\nBasketballs,10\nBadminton Rackets,20",
            new[] { "item_name", "quantity" }),
        [ImportType.Achievements] = new(
            "achievements_template.csv",
            "meet_year,sport,achievement_type,team_name,winner_student_id,notes\n2026,Basketball,Champion Team,Sapphire,,\n2026,Basketball,Best Player,Ruby,2024001,",
            new[] { "meet_year", "sport", "achievement_type", "team_name", "winner_student_id", "notes" }),
    };

    private static readonly IReadOnlyDictionary<ImportType, string[]> RequiredColumns = new Dictionary<ImportType, string[]>
    {
        [ImportType.Students] = Array.Empty<string>(),
        [ImportType.Records] = new[] { "student_id", "track_name", "value", "year" },
        [ImportType.Inventory] = new[] { "item_name", "quantity" },
        [ImportType.Achievements] = new[] { "meet_year", "sport", "achievement_type", "team_name" },
    };

    public static IReadOnlyList<string> PreviewLabels(ImportType type)
    {
        var t = Templates[type];
        return t.ColumnLabels ?? t.Columns.Select(c => c.Replace('_', ' ')).ToArray();
    }

    public static ImportPreviewRow ValidateRow(ImportType type, Dictionary<string, string> row, int line)
    {
        ImportPreviewRow Invalid(Dictionary<string, string> values, string error) =>
            new() { Values = values, Line = line, Valid = false, Error = error };

        if (type == ImportType.Students)
        {
            var normalized = StudentCsv.NormalizeRow(row);
            if (string.IsNullOrWhiteSpace(normalized.GetValueOrDefault("full_name")) &&
                string.IsNullOrWhiteSpace(normalized.GetValueOrDefault("student_id")))
            {
                return Invalid(normalized, "Missing Student ID or name");
            }
            return new ImportPreviewRow { Values = normalized, Line = line, Valid = true };
        }

        var missing = RequiredColumns[type]
            .Where(c => string.IsNullOrWhiteSpace(row.GetValueOrDefault(c)))
            .ToArray();
        if (missing.Length > 0) return Invalid(row, $"Missing: {string.Join(", ", missing)}");

        if (type == ImportType.Records)
        {
            var value = Formatting.ParseFloatLoose(row.GetValueOrDefault("value"));
            var year = Formatting.ParseIntLoose(row.GetValueOrDefault("year"));
            if (value is null || value < 0) return Invalid(row, "Invalid value");
            if (year is null) return Invalid(row, "Invalid year");
        }

        if (type == ImportType.Inventory)
        {
            var qty = Formatting.ParseIntLoose(row.GetValueOrDefault("quantity"));
            if (qty is null || qty < 0) return Invalid(row, "Invalid quantity");
        }

        if (type == ImportType.Achievements)
        {
            var meetYear = Formatting.ParseIntLoose(row.GetValueOrDefault("meet_year"));
            if (meetYear is null || meetYear < 1900 || meetYear > 2100) return Invalid(row, "Invalid meet_year");

            var achievementType = row.GetValueOrDefault("achievement_type")?.Trim() ?? "";
            if (!AchievementTypes.All.Contains(achievementType))
                return Invalid(row, $"achievement_type must be {string.Join(" or ", AchievementTypes.All)}");

            if (achievementType == AchievementTypes.BestPlayer &&
                string.IsNullOrWhiteSpace(row.GetValueOrDefault("winner_student_id")))
            {
                return Invalid(row, "winner_student_id required for Best Player");
            }
        }

        return new ImportPreviewRow { Values = row, Line = line, Valid = true };
    }
}
