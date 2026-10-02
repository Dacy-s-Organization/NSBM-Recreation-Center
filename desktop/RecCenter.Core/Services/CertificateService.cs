using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed record RenameArgs(string POld, string PNew);
internal sealed record AttachArgs(string PReference, string PFileName, string PContentType, string PImageBase64);
internal sealed record IdArgs(string PId);
internal sealed class ReferenceNoRow
{
    public string ReferenceNo { get; set; } = "";
}

internal sealed class RefBundle
{
    public string ReferenceNo { get; set; } = "";
    public List<IssuedCertificateMeta>? IssuedCertificates { get; set; }
}

public sealed class CertificateService
{
    public const int MaxBytes = 4 * 1024 * 1024;

    private static readonly HashSet<string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "image/heif", "image/heic", "image/heif-sequence", "image/heic-sequence",
    };

    private readonly PostgrestClient _db;

    public CertificateService(PostgrestClient db) => _db = db;

    public static bool TryParseReference(string raw, out string? value, out string? error)
    {
        value = raw.Trim().ToUpperInvariant();
        if (value.Length == 0)
        {
            value = null;
            error = null;
            return true;
        }

        var digits = value.Length == 7 && value.StartsWith("AA", StringComparison.Ordinal) && value[2..].All(char.IsDigit);
        if (!digits)
        {
            value = null;
            error = "Reference number must look like AA00001.";
            return false;
        }

        error = null;
        return true;
    }

    public static string? ContentTypeFor(string fileName, string declared)
    {
        if (ContentTypes.Contains(declared)) return declared.ToLowerInvariant();
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return ext switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "webp" => "image/webp",
            "gif" => "image/gif",
            "heif" => "image/heif",
            "heic" => "image/heic",
            _ => null,
        };
    }

    public static bool CanPreview(string contentType) =>
        contentType is "image/jpeg" or "image/png" or "image/webp" or "image/gif";

    public async Task<(string? Reference, string? Error)> SettleAsync(
        string column,
        string entryId,
        string typed,
        bool deleteEntryOnFailure,
        string table)
    {
        if (!TryParseReference(typed, out var requested, out var parseError))
        {
            if (deleteEntryOnFailure) await TryDeleteAsync(table, entryId);
            return (null, parseError);
        }

        ReferenceNoRow? current;
        try
        {
            current = await _db.MaybeSingleAsync<ReferenceNoRow>(PostgrestClient.From("certificate_references")
                .Select("reference_no")
                .Eq(column, entryId));
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }

        if (current is null || current.ReferenceNo.Length == 0)
            return (null, "The entry was saved, but its reference number could not be read.");
        if (requested is null || requested == current.ReferenceNo)
            return (current.ReferenceNo, null);

        try
        {
            await _db.RpcAsync("rename_certificate_reference", new RenameArgs(current.ReferenceNo, requested));
            return (requested, null);
        }
        catch (PostgrestException ex)
        {
            if (deleteEntryOnFailure) await TryDeleteAsync(table, entryId);
            return (null, ex.Message);
        }
    }

    public async Task<string?> StoreAsync(string reference, IReadOnlyList<CertificateUpload> uploads)
    {
        foreach (var file in uploads)
        {
            if (file.Bytes.Length == 0) continue;
            if (file.Bytes.Length > MaxBytes) return $"{file.FileName} is larger than 4 MB.";
            var contentType = ContentTypeFor(file.FileName, file.ContentType);
            if (contentType is null) return $"{file.FileName} must be a jpeg, png, webp, gif, or heif image.";
            try
            {
                await _db.RpcAsync("attach_issued_certificate", new AttachArgs(
                    reference,
                    file.FileName,
                    contentType,
                    Convert.ToBase64String(file.Bytes)));
            }
            catch (PostgrestException ex)
            {
                return ex.Message;
            }
        }
        return null;
    }

    public async Task<string?> RemoveAsync(IReadOnlyList<string> ids)
    {
        foreach (var id in ids)
        {
            if (string.IsNullOrWhiteSpace(id)) continue;
            try
            {
                await _db.RpcAsync("remove_issued_certificate", new IdArgs(id));
            }
            catch (PostgrestException ex)
            {
                return ex.Message;
            }
        }
        return null;
    }

    public async Task<(CertificateImage? Image, string? Error)> GetImageAsync(string id)
    {
        try
        {
            var rows = await _db.RpcAsync<List<CertificateImage>>("get_issued_certificate", new IdArgs(id));
            var image = rows?.FirstOrDefault();
            return image is null || image.ImageBase64.Length == 0
                ? (null, "Certificate not found.")
                : (image, null);
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }
    }

    public async Task<(Student? Student, List<StudentCertificate> Certificates, string? Error)> GetStudentAsync(string studentId)
    {
        var sid = studentId.Trim();
        if (sid.Length == 0) return (null, new List<StudentCertificate>(), "Student not found.");

        Student? student;
        try
        {
            student = await _db.MaybeSingleAsync<Student>(PostgrestClient.From("students")
                .Select("id, student_id, full_name, title, gender, faculty, intake, degree_programme, university, nic, mobile, email, houses(name)")
                .Eq("student_id", sid));
        }
        catch (PostgrestException ex)
        {
            return (null, new List<StudentCertificate>(), ex.Message);
        }
        if (student is null) return (null, new List<StudentCertificate>(), "Student not found.");

        var certificates = new List<StudentCertificate>();
        try
        {
            var records = await _db.GetAsync<IdRow>(PostgrestClient.From("sport_records").Select("id").Eq("student_id", student.Id));
            var wins = await _db.GetAsync<AchievementIdRow>(PostgrestClient.From("sports_achievement_winners")
                .Select("achievement_id").Eq("student_id", student.Id));
            if (records.Count > 0)
                certificates.AddRange(await CertificatesForAsync("sport_record_id", records.Select(r => r.Id)));
            if (wins.Count > 0)
                certificates.AddRange(await CertificatesForAsync("sports_achievement_id", wins.Select(w => w.AchievementId)));
        }
        catch (PostgrestException ex)
        {
            return (student, certificates, ex.Message);
        }

        return (student, certificates, null);
    }

    private async Task<List<StudentCertificate>> CertificatesForAsync(string column, IEnumerable<string> ids)
    {
        var rows = await _db.GetAsync<RefBundle>(PostgrestClient.From("certificate_references")
            .Select("reference_no, issued_certificates(id, file_name, content_type)")
            .In(column, ids));
        return rows.SelectMany(row => (row.IssuedCertificates ?? new List<IssuedCertificateMeta>())
            .Select(file => new StudentCertificate
            {
                Id = file.Id,
                FileName = file.FileName,
                ContentType = file.ContentType,
                ReferenceNo = row.ReferenceNo,
            })).ToList();
    }

    private async Task TryDeleteAsync(string table, string id)
    {
        try
        {
            await _db.DeleteAsync(PostgrestClient.From(table).Eq("id", id));
        }
        catch (PostgrestException)
        {
            /* the caller still reports the reference error */
        }
    }

    private sealed class AchievementIdRow
    {
        public string AchievementId { get; set; } = "";
    }
}
