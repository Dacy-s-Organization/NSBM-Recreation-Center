namespace RecCenter.Core.Domain;

public enum AchievementSection
{
    SportsFiesta,
    InterUniversity,
}

public sealed record AchievementSectionConfig(
    string Key,
    string Label,
    string RecordsTable,
    string AchievementsTable,
    string WinnersTable,
    string RecordRefColumn,
    string AchievementRefColumn,
    bool HasCategories);

public static class AchievementSections
{
    public static readonly AchievementSectionConfig SportsFiesta = new(
        "sports-fiesta",
        "Sports Fiesta",
        "sport_records",
        "sports_achievements",
        "sports_achievement_winners",
        "sport_record_id",
        "sports_achievement_id",
        HasCategories: true);

    public static readonly AchievementSectionConfig InterUniversity = new(
        "inter-university",
        "Inter University",
        "inter_uni_records",
        "inter_uni_achievements",
        "inter_uni_achievement_winners",
        "inter_uni_record_id",
        "inter_uni_achievement_id",
        HasCategories: false);

    public static AchievementSectionConfig Get(AchievementSection section) =>
        section == AchievementSection.InterUniversity ? InterUniversity : SportsFiesta;

    public static AchievementSection? Parse(string? raw) => (raw ?? "").Trim() switch
    {
        "sports-fiesta" => AchievementSection.SportsFiesta,
        "inter-university" => AchievementSection.InterUniversity,
        _ => null,
    };

    public static string AchievementsPath(AchievementSection section, int? year = null)
    {
        var path = $"/achievements/{Get(section).Key}";
        return year is null ? path : $"{path}?year={year}";
    }

    public static string RecordsPath(AchievementSection section, int? year = null)
    {
        var path = $"/achievements/{Get(section).Key}/records";
        return year is null ? path : $"{path}?year={year}";
    }
}
