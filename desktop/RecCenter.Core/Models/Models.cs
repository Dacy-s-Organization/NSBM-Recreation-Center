using System.Text.Json;
using System.Text.Json.Serialization;

namespace RecCenter.Core.Models;

public sealed class House
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed class YearRow
{
    public int Year { get; set; }
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
    public string? Nic { get; set; }
}

public sealed class StudentLookup
{
    public string? StudentId { get; set; }
    public string FullName { get; set; } = "";
    public string? Gender { get; set; }
    public string? Nic { get; set; }
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
    [System.Text.Json.Serialization.JsonConverter(typeof(OneOrManyConverter<CertificateReference>))]
    public CertificateReference? CertificateReferences { get; set; }
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
    public string? Place { get; set; }
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
    [System.Text.Json.Serialization.JsonConverter(typeof(OneOrManyConverter<CertificateReference>))]
    public CertificateReference? CertificateReferences { get; set; }
}

public sealed class IssuedCertificateMeta
{
    public string Id { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
}

public sealed class CertificateReference
{
    public string ReferenceNo { get; set; } = "";
    public List<IssuedCertificateMeta>? IssuedCertificates { get; set; }
}

public sealed class CertificateUpload
{
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public byte[] Bytes { get; set; } = Array.Empty<byte>();
}

public sealed class CertificateImage
{
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string ImageBase64 { get; set; } = "";
}

public sealed class StudentCertificate
{
    public string Id { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "";
    public string ReferenceNo { get; set; } = "";
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
    /// <summary>Students whose empty fields were filled. Null unless this was a student import.</summary>
    public int? Filled { get; set; }
    /// <summary>Students that already had every supplied field. Null unless this was a student import.</summary>
    public int? Unchanged { get; set; }
    /// <summary>Students where the file disagreed and the stored value was kept.</summary>
    public int? Kept { get; set; }
    public List<string> Errors { get; } = new();
    public List<string> Notices { get; } = new();
}

/// <summary>PostgREST returns a to-one embed as an object and a to-many embed as an array.</summary>
public sealed class OneOrManyConverter<T> : JsonConverter<T?> where T : class
{
    public override T? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null) return null;
        if (reader.TokenType == JsonTokenType.StartArray)
        {
            var list = JsonSerializer.Deserialize<List<T>>(ref reader, options);
            return list is { Count: > 0 } ? list[0] : null;
        }
        return JsonSerializer.Deserialize<T>(ref reader, options);
    }

    public override void Write(Utf8JsonWriter writer, T? value, JsonSerializerOptions options) =>
        JsonSerializer.Serialize(writer, value, options);
}
