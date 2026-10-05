using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

public sealed class ReferenceService
{
    private readonly PostgrestClient _db;

    public ReferenceService(PostgrestClient db) => _db = db;

    public Task<List<House>> GetHousesAsync() =>
        _db.GetAsync<House>(PostgrestClient.From("houses").Select("id, name").Order("name"));

    public Task<List<SportTrack>> GetSportTracksAsync() =>
        _db.GetAsync<SportTrack>(PostgrestClient.From("sport_tracks").Select("id, name, unit, lower_is_better").Order("name"));

    public async Task<List<int>> GetYearsAsync(AchievementSection section, bool achievements)
    {
        var config = AchievementSections.Get(section);
        var table = achievements ? config.AchievementsTable : config.RecordsTable;
        var column = achievements ? "meet_year" : "year";
        try
        {
            var rows = await _db.GetAsync<YearValue>(PostgrestClient.From(table).Select(column));
            return rows
                .Select(row => achievements ? row.MeetYear : row.Year)
                .Where(year => year > 0)
                .Distinct()
                .ToList();
        }
        catch (PostgrestException)
        {
            return new List<int>();
        }
    }

    private sealed class YearValue
    {
        public int Year { get; set; }
        public int MeetYear { get; set; }
    }
}

public sealed class DashboardService
{
    private readonly PostgrestClient _db;

    public DashboardService(PostgrestClient db) => _db = db;

    public async Task<DashboardStats> GetStatsAsync()
    {
        var year = DateTime.Now.Year;
        var students = _db.CountAsync(PostgrestClient.From("students").Select("*"));
        var records = _db.CountAsync(PostgrestClient.From("sport_records").Select("*").Eq("year", year));
        var inventory = _db.CountAsync(PostgrestClient.From("inventory_items").Select("*"));
        await Task.WhenAll(students, records, inventory);
        return new DashboardStats(students.Result, records.Result, inventory.Result, year);
    }
}
