using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record AchievementPayload(int MeetYear, string Sport, string AchievementType, string? TeamName, string? Notes);

internal sealed record SportInsert(string Name, int SortOrder);

internal sealed record WinnerPayload(string AchievementId, string StudentId, string? Place);

public sealed class AchievementsService
{
    private readonly PostgrestClient _db;
    private readonly CertificateService _certificates;

    public AchievementsService(PostgrestClient db, CertificateService certificates)
    {
        _db = db;
        _certificates = certificates;
    }

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
                      sports_achievement_winners(student_id, place, students(student_id, full_name, nic)),
                      certificate_references(reference_no, issued_certificates(id, file_name, content_type))")
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

        var winners = await WinnersFromFormAsync(form, payload!.AchievementType);
        if (winners.Error is not null) return ActionResult.Fail(winners.Error);

        var sport = await ResolveSportAsync(form);
        if (sport.Error is not null) return ActionResult.Fail(sport.Error);
        payload = payload with { Sport = sport.Name! };

        List<IdRow> inserted;
        try
        {
            inserted = await _db.InsertAsync<IdRow>("sports_achievements", payload, "id");
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
        if (inserted.Count == 0) return ActionResult.Fail("The achievement could not be saved.");

        var settled = await _certificates.SettleAsync("sports_achievement_id", inserted[0].Id, form.ReferenceNo, deleteEntryOnFailure: true, "sports_achievements");
        if (settled.Error is not null) return ActionResult.Fail(settled.Error);

        if (winners.Rows.Count > 0)
        {
            try
            {
                await _db.InsertAsync("sports_achievement_winners", winners.Rows.Select(row => new WinnerPayload(inserted[0].Id, row.StudentId, row.Place)).ToList());
            }
            catch (PostgrestException ex)
            {
                return ActionResult.Fail(ex.Message);
            }
        }

        var fileError = await _certificates.StoreAsync(settled.Reference!, form.Uploads);
        if (fileError is not null)
            return ActionResult.Fail($"The achievement was saved as {settled.Reference}, but a certificate could not be stored: {fileError}");
        return ActionResult.Ok;
    }

    public async Task<ActionResult> UpdateAsync(AchievementForm form)
    {
        var (error, payload) = Parse(form, requireId: true);
        if (error is not null) return ActionResult.Fail(error);
        var id = form.Id.Trim();

        var winners = await WinnersFromFormAsync(form, payload!.AchievementType);
        if (winners.Error is not null) return ActionResult.Fail(winners.Error);

        var settled = await _certificates.SettleAsync("sports_achievement_id", id, form.ReferenceNo, deleteEntryOnFailure: false, "sports_achievements");
        if (settled.Error is not null) return ActionResult.Fail(settled.Error);

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

        if (winners.Rows.Count > 0)
        {
            try
            {
                await _db.InsertAsync("sports_achievement_winners", winners.Rows.Select(row => new WinnerPayload(id, row.StudentId, row.Place)).ToList());
            }
            catch (PostgrestException ex)
            {
                return ActionResult.Fail(ex.Message);
            }
        }

        var removeError = await _certificates.RemoveAsync(form.RemoveCertificateIds);
        if (removeError is not null) return ActionResult.Fail(removeError);
        var fileError = await _certificates.StoreAsync(settled.Reference!, form.Uploads);
        if (fileError is not null) return ActionResult.Fail(fileError);
        return ActionResult.Ok;
    }

    private async Task<(List<(string StudentId, string? Place)> Rows, string? Error)> WinnersFromFormAsync(AchievementForm form, string type)
    {
        if (type == AchievementTypes.BestPlayer)
        {
            if (form.WinnerStudentId.Trim().Length == 0)
                return (new(), "Student ID is required for Best Player.");
            var student = await ResolveStudentAsync(form.WinnerStudentId);
            if (student.Error is not null) return (new(), student.Error);
            return student.Uuid is null ? (new(), "Student ID is required for Best Player.") : (new() { (student.Uuid, null) }, null);
        }

        if (type != AchievementTypes.Champion)
        {
            var student = await ResolveStudentAsync(form.WinnerStudentId);
            if (student.Error is not null) return (new(), student.Error);
            return student.Uuid is null ? (new(), null) : (new() { (student.Uuid, null) }, null);
        }

        var rows = new List<(string StudentId, string? Place)>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in form.Places)
        {
            var studentIdText = entry.StudentId.Trim();
            if (studentIdText.Length == 0) continue;
            if (entry.Place is not ("1st" or "2nd" or "3rd"))
                return (new(), "Each champion place must be 1st, 2nd, or 3rd.");
            var student = await ResolveStudentAsync(studentIdText);
            if (student.Error is not null) return (new(), student.Error);
            if (student.Uuid is null) continue;
            if (!seen.Add(student.Uuid))
                return (new(), $"Student {studentIdText} is listed more than once.");
            rows.Add((student.Uuid, entry.Place));
        }
        return (rows, null);
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
