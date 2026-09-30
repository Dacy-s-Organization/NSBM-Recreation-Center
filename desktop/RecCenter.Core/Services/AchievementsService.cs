using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record AchievementPayload(int MeetYear, string Sport, string AchievementType, string? TeamName, string? Notes);

internal sealed record SportInsert(string Name, int SortOrder);

internal sealed record WinnerPayload(string AchievementId, string StudentId);

public sealed class AchievementsService
{
    private readonly PostgrestClient _db;

    public AchievementsService(PostgrestClient db) => _db = db;

    public Task<List<Sport>> ListSportsAsync() =>
        _db.GetAsync<Sport>(PostgrestClient.From("sports").Select("id, name, sort_order").Order("sort_order").Order("name"));

    public async Task<(string? Name, string? Error)> EnsureNewSportAsync(string raw)
    {
        var trimmed = raw.Trim();
        if (trimmed.Length == 0) return (null, "Enter a name for the new sport.");

        List<Sport> existing;
        try
        {
            existing = await ListSportsAsync();
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }

        var match = existing.FirstOrDefault(s => string.Equals(s.Name, trimmed, StringComparison.OrdinalIgnoreCase));
        if (match is not null)
            return (null, $"\"{match.Name}\" is already in the sport list. Choose it from the menu.");

        var sortOrder = existing.Count == 0 ? 1 : existing.Max(s => s.SortOrder) + 1;
        try
        {
            await _db.InsertAsync("sports", new SportInsert(trimmed, sortOrder));
            return (trimmed, null);
        }
        catch (PostgrestException ex) when (ex.Code == "23505")
        {
            return (null, $"\"{trimmed}\" is already in the sport list. Choose it from the menu.");
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }
    }

    public async Task<(Dictionary<string, string>? Canonical, string? Error)> EnsureImportedSportsAsync(IEnumerable<string> names)
    {
        List<Sport> existing;
        try
        {
            existing = await ListSportsAsync();
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }

        var known = existing.ToDictionary(s => s.Name.ToLowerInvariant(), s => s.Name);
        var sortOrder = existing.Count == 0 ? 0 : existing.Max(s => s.SortOrder);
        foreach (var raw in names)
        {
            var trimmed = raw.Trim();
            if (trimmed.Length == 0) continue;
            var key = trimmed.ToLowerInvariant();
            if (known.ContainsKey(key)) continue;
            sortOrder++;
            try
            {
                await _db.InsertAsync("sports", new SportInsert(trimmed, sortOrder));
                known[key] = trimmed;
            }
            catch (PostgrestException ex) when (ex.Code == "23505")
            {
                known[key] = trimmed;
            }
            catch (PostgrestException ex)
            {
                return (null, ex.Message);
            }
        }

        return (known, null);
    }

    public Task<List<SportsAchievement>> GetForYearAsync(int year) =>
        _db.GetAsync<SportsAchievement>(PostgrestClient.From("sports_achievements")
            .Select(@"id, meet_year, sport, achievement_type, team_name, notes, created_at,
                      sports_achievement_winners(student_id, students(student_id, full_name))")
            .Eq("meet_year", year)
            .Order("created_at", ascending: false));

    private async Task<(string? Name, string? Error)> ResolveSportAsync(AchievementForm form)
    {
        var choice = form.Sport.Trim();
        if (choice == AchievementTypes.NewSport) return await EnsureNewSportAsync(form.NewSport);
        if (choice.Length == 0) return (null, "Sport, achievement type, and year are required.");
        return (choice, null);
    }

    private async Task<(string? Uuid, string? Error)> ResolveStudentAsync(string studentIdText)
    {
        var sid = studentIdText.Trim();
        if (sid.Length == 0) return (null, null);
        IdRow? row = null;
        try
        {
            row = await _db.MaybeSingleAsync<IdRow>(PostgrestClient.From("students").Select("id").Eq("student_id", sid));
        }
        catch (PostgrestException)
        {
            /* treated as not found */
        }
        return row is null ? (null, $"Student \"{sid}\" not found.") : (row.Id, null);
    }

    private static (string? Error, AchievementPayload? Payload) Parse(AchievementForm form, bool requireId)
    {
        var meetYear = Formatting.ParseIntLoose(form.MeetYear);
        var sport = form.Sport.Trim();
        var type = AchievementTypes.Parse(form.AchievementType);
        var teamName = FormText.NullIfEmpty(form.TeamName);
        var notes = FormText.NullIfEmpty(form.Notes);

        if ((requireId && form.Id.Trim().Length == 0) || sport.Length == 0 || type is null || meetYear is null)
            return ("Sport, achievement type, and year are required.", null);
        if (teamName is null) return ("House (team) is required.", null);

        return (null, new AchievementPayload(meetYear.Value, sport, type, teamName, notes));
    }

    public async Task<ActionResult> AddAsync(AchievementForm form)
    {
        var (error, payload) = Parse(form, requireId: false);
        if (error is not null) return ActionResult.Fail(error);

        if (payload!.AchievementType == AchievementTypes.BestPlayer && form.WinnerStudentId.Trim().Length == 0)
            return ActionResult.Fail("Student ID is required for Best Player.");

        var student = await ResolveStudentAsync(form.WinnerStudentId);
        if (student.Error is not null) return ActionResult.Fail(student.Error);
        var winnerUuid = student.Uuid;

        var sport = await ResolveSportAsync(form);
        if (sport.Error is not null) return ActionResult.Fail(sport.Error);
        payload = payload with { Sport = sport.Name! };

        try
        {
            var inserted = await _db.InsertAsync<IdRow>("sports_achievements", payload, "id");
            if (winnerUuid is not null && inserted.Count > 0)
            {
                await _db.InsertAsync("sports_achievement_winners", new WinnerPayload(inserted[0].Id, winnerUuid));
            }
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }

    public async Task<ActionResult> UpdateAsync(AchievementForm form)
    {
        var (error, payload) = Parse(form, requireId: true);
        if (error is not null) return ActionResult.Fail(error);
        var id = form.Id.Trim();

        if (payload!.AchievementType == AchievementTypes.BestPlayer && form.WinnerStudentId.Trim().Length == 0)
            return ActionResult.Fail("Student ID is required for Best Player.");

        var student = await ResolveStudentAsync(form.WinnerStudentId);
        if (student.Error is not null) return ActionResult.Fail(student.Error);
        var winnerUuid = student.Uuid;

        var sport = await ResolveSportAsync(form);
        if (sport.Error is not null) return ActionResult.Fail(sport.Error);
        payload = payload with { Sport = sport.Name! };

        try
        {
            await _db.UpdateAsync(PostgrestClient.From("sports_achievements").Eq("id", id), payload);
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }

        try
        {
            await _db.DeleteAsync(PostgrestClient.From("sports_achievement_winners").Eq("achievement_id", id));
        }
        catch (PostgrestException)
        {
            /* the web action ignores this result too */
        }

        if (winnerUuid is not null)
        {
            try
            {
                await _db.InsertAsync("sports_achievement_winners", new WinnerPayload(id, winnerUuid));
            }
            catch (PostgrestException ex)
            {
                return ActionResult.Fail(ex.Message);
            }
        }
        return ActionResult.Ok;
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Invalid achievement.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("sports_achievements").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }
}
