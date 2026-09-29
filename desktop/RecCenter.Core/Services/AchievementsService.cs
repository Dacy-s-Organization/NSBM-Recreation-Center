using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record AchievementPayload(int MeetYear, string Sport, string AchievementType, string? TeamName, string? Notes);

internal sealed record WinnerPayload(string AchievementId, string StudentId);

public sealed class AchievementsService
{
    private readonly PostgrestClient _db;

    public AchievementsService(PostgrestClient db) => _db = db;

    public Task<List<SportsAchievement>> GetForYearAsync(int year) =>
        _db.GetAsync<SportsAchievement>(PostgrestClient.From("sports_achievements")
            .Select(@"id, meet_year, sport, achievement_type, team_name, notes, created_at,
                      sports_achievement_winners(student_id, students(student_id, full_name))")
            .Eq("meet_year", year)
            .Order("created_at", ascending: false));

    private async Task<(string? Uuid, string? Error)> ResolveBestPlayerAsync(string studentIdText)
    {
        var sid = studentIdText.Trim();
        if (sid.Length == 0) return (null, "Student ID is required for Best Player.");
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

        string? winnerUuid = null;
        if (payload!.AchievementType == AchievementTypes.BestPlayer)
        {
            var resolved = await ResolveBestPlayerAsync(form.WinnerStudentId);
            if (resolved.Error is not null) return ActionResult.Fail(resolved.Error);
            winnerUuid = resolved.Uuid;
        }

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

        string? winnerUuid = null;
        if (payload!.AchievementType == AchievementTypes.BestPlayer)
        {
            var resolved = await ResolveBestPlayerAsync(form.WinnerStudentId);
            if (resolved.Error is not null) return ActionResult.Fail(resolved.Error);
            winnerUuid = resolved.Uuid;
        }

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
