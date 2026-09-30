namespace RecCenter.Core.Models;

public sealed class House
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed class NameRef
{
    public string? Name { get; set; }
}

public sealed class Student
{
    public string Id { get; set; } = "";
    public string? StudentId { get; set; }
    public string FullName { get; set; } = "";
    public string? HouseId { get; set; }
    public int? SerialNo { get; set; }
    public string? Faculty { get; set; }
    public string? Intake { get; set; }
    public string? DegreeProgramme { get; set; }
    public string? University { get; set; }
    public string? Title { get; set; }
    public string? Gender { get; set; }
    public string? Nic { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? CreatedAt { get; set; }
    public NameRef? Houses { get; set; }
}

public sealed class StudentRef
{
    public string? StudentId { get; set; }
    public string? FullName { get; set; }
    public string? Gender { get; set; }
}

public sealed class StudentLookup
{
    public string? StudentId { get; set; }
    public string FullName { get; set; } = "";
    public string? Gender { get; set; }
    public NameRef? Houses { get; set; }
}

public sealed class SportTrack
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "";
    public bool LowerIsBetter { get; set; }
}

public sealed class TrackRef
{
    public string Name { get; set; } = "";
    public string? Unit { get; set; }
    public bool LowerIsBetter { get; set; }
}

public sealed class SportRecord
{
    public string Id { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string TrackId { get; set; } = "";
    public int Year { get; set; }
    public double Value { get; set; }
    public DateTimeOffset RecordedAt { get; set; }
    public StudentRef? Students { get; set; }
    public TrackRef? SportTracks { get; set; }
}

public sealed class InventoryItem
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int Quantity { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class Sport
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }
}

public sealed class AchievementWinner
{
    public string? StudentId { get; set; }
    public StudentRef? Students { get; set; }
}

public sealed class SportsAchievement
{
    public string Id { get; set; } = "";
    public int MeetYear { get; set; }
    public string Sport { get; set; } = "";
    public string AchievementType { get; set; } = "";
    public string? TeamName { get; set; }
    public string? Notes { get; set; }
    public string? CreatedAt { get; set; }
    public List<AchievementWinner>? SportsAchievementWinners { get; set; }
}

public sealed record FacultyCard(string Code, string Name, string Description, int Count);

public sealed record IntakeCard(string Intake, int Count);

public sealed record DashboardStats(int Students, int Records, int InventoryItems, int Year);

/// <summary>Result of a mutation, mirroring the server actions' <c>{ error } | { success }</c>.</summary>
public sealed record ActionResult(string? Error)
{
    public static readonly ActionResult Ok = new((string?)null);
    public bool Success => Error is null;
    public static ActionResult Fail(string error) => new(error);
}

public sealed class ImportResult
{
    public int Success { get; set; }
    public int Inserted { get; set; }
    public int Updated { get; set; }
    public int Skipped { get; set; }
    public List<string> Errors { get; } = new();
}
