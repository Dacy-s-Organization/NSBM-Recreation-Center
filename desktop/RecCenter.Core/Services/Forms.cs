namespace RecCenter.Core.Services;

/// <summary>Raw form values, equivalent to the web app's FormData (all strings, trimmed on save).</summary>
public sealed class StudentForm
{
    public string Id { get; set; } = "";
    public string SerialNo { get; set; } = "";
    public string Intake { get; set; } = "";
    public string Faculty { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string DegreeProgramme { get; set; } = "";
    public string University { get; set; } = "";
    public string Title { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Gender { get; set; } = "";
    public string Nic { get; set; } = "";
    public string Mobile { get; set; } = "";
    public string Email { get; set; } = "";
    public string HouseId { get; set; } = "";

    public static StudentForm From(Models.Student s) => new()
    {
        Id = s.Id,
        SerialNo = s.SerialNo?.ToString() ?? "",
        Intake = s.Intake ?? "",
        Faculty = s.Faculty ?? "",
        StudentId = s.StudentId ?? "",
        DegreeProgramme = s.DegreeProgramme ?? "",
        University = s.University ?? "",
        Title = s.Title ?? "",
        FullName = s.FullName,
        Gender = s.Gender ?? "",
        Nic = s.Nic ?? "",
        Mobile = s.Mobile ?? "",
        Email = s.Email ?? "",
        HouseId = s.HouseId ?? "",
    };
}

public sealed class RecordForm
{
    public string Id { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string TrackId { get; set; } = "";
    public string Value { get; set; } = "";
    public string Year { get; set; } = "";
}

public sealed class TrackForm
{
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "s";
    public bool LowerIsBetter { get; set; }
}

public sealed class AchievementForm
{
    public string Id { get; set; } = "";
    public string Sport { get; set; } = "";
    public string AchievementType { get; set; } = "";
    public string MeetYear { get; set; } = "";
    public string TeamName { get; set; } = "";
    public string WinnerStudentId { get; set; } = "";
    public string NewSport { get; set; } = "";
    public string Notes { get; set; } = "";
}

public sealed class InventoryForm
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Quantity { get; set; } = "";
}

internal static class FormText
{
    public static string? NullIfEmpty(string? value)
    {
        var trimmed = value?.Trim() ?? "";
        return trimmed.Length == 0 ? null : trimmed;
    }
}
