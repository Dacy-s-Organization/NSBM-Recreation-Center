using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record RecordPayload(string StudentId, string TrackId, int Year, double Value);

internal sealed record IdRow(string Id);

public sealed class RecordsService
{
    public const int RecordsLimit = 500;

    private readonly PostgrestClient _db;

    public RecordsService(PostgrestClient db) => _db = db;

    public Task<List<SportRecord>> GetForYearAsync(int year) =>
        _db.GetAsync<SportRecord>(PostgrestClient.From("sport_records")
            .Select(@"id, student_id, track_id, year, value, recorded_at,
                      students(student_id, full_name, gender),
                      sport_tracks(name, unit, lower_is_better)")
            .Eq("year", year)
            .Order("recorded_at", ascending: false)
            .Limit(RecordsLimit));

    public Task<List<SportRecord>> GetForTrackYearAsync(string trackId, int year) =>
        _db.GetAsync<SportRecord>(PostgrestClient.From("sport_records")
            .Select(@"id, student_id, track_id, year, value, recorded_at,
                      students(student_id, full_name, gender),
                      sport_tracks(name, unit, lower_is_better)")
            .Eq("track_id", trackId)
            .Eq("year", year));

    public async Task<StudentLookup?> LookupStudentAsync(string studentId)
    {
        return await _db.MaybeSingleAsync<StudentLookup>(PostgrestClient.From("students")
            .Select("student_id, full_name, gender, houses(name)")
            .Eq("student_id", studentId.Trim()));
    }

    private static (string? Error, string StudentIdText, string TrackId, double Value, int Year) Validate(RecordForm form, bool requireId)
    {
        var studentIdText = form.StudentId.Trim();
        var trackId = form.TrackId.Trim();
        var value = Formatting.ParseFloatLoose(form.Value);
        var year = Formatting.ParseIntLoose(form.Year);

        if ((requireId && form.Id.Trim().Length == 0) || studentIdText.Length == 0 || trackId.Length == 0 || value is null || value < 0)
            return ("Please provide a valid student ID, track, and value.", "", "", 0, 0);
        if (year is null || year < 1900 || year > 2100)
            return ("Please provide a valid year.", "", "", 0, 0);

        return (null, studentIdText, trackId, value.Value, year.Value);
    }

    private async Task<string?> FindStudentUuidAsync(string studentIdText)
    {
        try
        {
            var row = await _db.MaybeSingleAsync<IdRow>(PostgrestClient.From("students").Select("id").Eq("student_id", studentIdText));
            return row?.Id;
        }
        catch (PostgrestException)
        {
            return null;
        }
    }

    /// <param name="replaceIds">Records to remove once the new one is saved, so a failed save never loses the previous holder.</param>
    public async Task<ActionResult> AddAsync(RecordForm form, IReadOnlyCollection<string>? replaceIds = null)
    {
        var v = Validate(form, requireId: false);
        if (v.Error is not null) return ActionResult.Fail(v.Error);

        var studentUuid = await FindStudentUuidAsync(v.StudentIdText);
        if (studentUuid is null) return ActionResult.Fail("Student not found. Add them first or check the ID.");

        try
        {
            await _db.InsertAsync("sport_records", new RecordPayload(studentUuid, v.TrackId, v.Year, v.Value));
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(DuplicateMessage(ex));
        }
        return await DeleteReplacedAsync(replaceIds);
    }

    /// <param name="replaceIds">Records to remove once the edit is saved.</param>
    public async Task<ActionResult> UpdateAsync(RecordForm form, IReadOnlyCollection<string>? replaceIds = null)
    {
        var v = Validate(form, requireId: true);
        if (v.Error is not null) return ActionResult.Fail(v.Error);

        var studentUuid = await FindStudentUuidAsync(v.StudentIdText);
        if (studentUuid is null) return ActionResult.Fail("Student not found. Check the ID.");

        try
        {
            await _db.UpdateAsync(PostgrestClient.From("sport_records").Eq("id", form.Id.Trim()),
                new RecordPayload(studentUuid, v.TrackId, v.Year, v.Value));
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(DuplicateMessage(ex));
        }
        return await DeleteReplacedAsync(replaceIds);
    }

    private static string DuplicateMessage(PostgrestException ex) =>
        ex.Code == "23505" ? "This student already has a record for this track and year. Use Edit to change it." : ex.Message;

    private async Task<ActionResult> DeleteReplacedAsync(IReadOnlyCollection<string>? ids)
    {
        if (ids is null || ids.Count == 0) return ActionResult.Ok;
        try
        {
            foreach (var id in ids)
                await _db.DeleteAsync(PostgrestClient.From("sport_records").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail("The new record was saved, but the previous record could not be removed: " + ex.Message);
        }
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Invalid record.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("sport_records").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }
}

internal sealed record TrackPayload(string Name, string Unit, bool LowerIsBetter);

public sealed class TracksService
{
    private readonly PostgrestClient _db;

    public TracksService(PostgrestClient db) => _db = db;

    public async Task<ActionResult> AddAsync(TrackForm form)
    {
        var name = form.Name.Trim();
        var unit = form.Unit.Trim();
        if (name.Length == 0) return ActionResult.Fail("Track name is required.");
        if (unit.Length == 0) return ActionResult.Fail("Unit is required (e.g. s for seconds, m for meters).");

        try
        {
            await _db.InsertAsync("sport_tracks", new TrackPayload(name, unit, form.LowerIsBetter));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23505" ? "A track with this name already exists." : ex.Message);
        }
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Invalid track.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("sport_tracks").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23503"
                ? "Cannot delete: this track has athletic records. Remove those records first."
                : ex.Message);
        }
    }
}
