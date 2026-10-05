using System.Globalization;
using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record StudentPayload(
    string? StudentId,
    string FullName,
    string? HouseId,
    int? SerialNo,
    string? Faculty,
    string? Intake,
    string? DegreeProgramme,
    string? University,
    string? Title,
    string? Gender,
    string? Nic,
    string? Mobile,
    string? Email);

public sealed class StudentsService
{
    public const string StudentSelect =
        "id, student_id, full_name, house_id, serial_no, faculty, intake, degree_programme, university, title, gender, nic, mobile, email, created_at, houses(name)";

    private readonly PostgrestClient _db;

    public StudentsService(PostgrestClient db) => _db = db;

    /// <summary>Exact counts per faculty (avoids PostgREST 1000-row select cap).</summary>
    public async Task<List<FacultyCard>> GetFacultyCardsAsync()
    {
        var counts = await Task.WhenAll(Faculties.All.Select(async f =>
        {
            var count = await _db.CountAsync(PostgrestClient.From("students").Select("*").In("faculty", Faculties.StoredCodes(f.Code)));
            return (f.Code, count);
        }));
        var map = counts.ToDictionary(c => c.Code, c => c.count);
        return Faculties.All.Select(f => new FacultyCard(f.Code, f.Name, f.Description, map.GetValueOrDefault(f.Code))).ToList();
    }

    public async Task<List<IntakeCard>> GetIntakeCardsAsync(string faculty)
    {
        var normalized = Faculties.NormalizeCode(faculty);
        if (normalized.Length == 0) normalized = faculty;
        var codes = Faculties.StoredCodes(normalized);

        var intakes = new HashSet<string>();
        try
        {
            var rows = await _db.GetAllPagesAsync<Student>(() =>
                PostgrestClient.From("students").Select("intake").In("faculty", codes));
            foreach (var row in rows)
            {
                var intake = row.Intake?.Trim();
                if (!string.IsNullOrEmpty(intake)) intakes.Add(intake);
            }
        }
        catch (PostgrestException)
        {
            /* show whatever was collected, like the web app */
        }

        var cards = await Task.WhenAll(intakes.Select(async intake =>
        {
            var count = await _db.CountAsync(PostgrestClient.From("students").Select("*").In("faculty", codes).Eq("intake", intake));
            return new IntakeCard(intake, count);
        }));

        return cards
            .OrderBy(c => c.Intake, Comparer<string>.Create((a, b) => string.Compare(b, a, CultureInfo.CurrentCulture, CompareOptions.None)))
            .ToList();
    }

    public Task<List<Student>> GetBatchStudentsAsync(string faculty, string intake) =>
        _db.GetAllPagesAsync<Student>(() => PostgrestClient.From("students")
            .Select(StudentSelect)
            .Eq("faculty", faculty)
            .Eq("intake", intake)
            .Order("full_name")
            .Order("id"));

    public const int SearchLimit = 50;
    public const int SearchMinLength = 2;

    private static readonly string[] SearchColumns = { "student_id", "full_name", "email", "nic", "mobile" };

    /// <summary>Case-insensitive search across every faculty and batch, capped at <see cref="SearchLimit"/> rows.</summary>
    public Task<List<Student>> SearchAsync(string query)
    {
        var term = new string(query.Where(c => c is not (',' or '(' or ')' or '*' or '\\' or '%' or '"' or '\'')).ToArray()).Trim();
        if (term.Length < SearchMinLength) return Task.FromResult(new List<Student>());

        var filter = string.Join(",", SearchColumns.Select(column => $"{column}.ilike.*{term}*"));
        return _db.GetAsync<Student>(PostgrestClient.From("students")
            .Select("id, student_id, full_name, faculty, intake, houses(name)")
            .Or(filter)
            .Order("full_name")
            .Order("id")
            .Limit(SearchLimit));
    }

    internal static StudentPayload Parse(StudentForm form)
    {
        var serialRaw = form.SerialNo.Trim();
        var serial = serialRaw.Length > 0 ? Formatting.ParseIntLoose(serialRaw) : null;
        return new StudentPayload(
            FormText.NullIfEmpty(form.StudentId),
            form.FullName.Trim(),
            FormText.NullIfEmpty(form.HouseId),
            serial,
            FormText.NullIfEmpty(Faculties.NormalizeCode(form.Faculty)),
            FormText.NullIfEmpty(form.Intake),
            FormText.NullIfEmpty(form.DegreeProgramme),
            FormText.NullIfEmpty(form.University),
            FormText.NullIfEmpty(form.Title),
            FormText.NullIfEmpty(form.Gender),
            FormText.NullIfEmpty(form.Nic),
            FormText.NullIfEmpty(form.Mobile),
            FormText.NullIfEmpty(form.Email));
    }

    public async Task<ActionResult> AddAsync(StudentForm form)
    {
        var data = Parse(form);
        if (data.FullName.Length == 0) return ActionResult.Fail("Name is required.");

        try
        {
            await _db.InsertAsync("students", data);
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23505" ? "A student with this ID already exists." : ex.Message);
        }
    }

    public async Task<ActionResult> UpdateAsync(StudentForm form)
    {
        var id = form.Id.Trim();
        var data = Parse(form);
        if (id.Length == 0 || data.FullName.Length == 0) return ActionResult.Fail("Name is required.");

        try
        {
            await _db.UpdateAsync(PostgrestClient.From("students").Eq("id", id), data);
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Code == "23505" ? "A student with this ID already exists." : ex.Message);
        }
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Invalid student.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("students").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }
}
