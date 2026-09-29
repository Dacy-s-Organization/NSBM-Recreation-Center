using System.Text.RegularExpressions;

namespace RecCenter.Core.Domain;

/// <summary>Maps NSBM Foundation CSV headers (and legacy app headers) to canonical student fields.</summary>
public static partial class StudentCsv
{
    private static readonly Dictionary<string, string> HeaderAliases = new()
    {
        ["serial_no"] = "serial_no",
        ["serial no"] = "serial_no",
        ["intake"] = "intake",
        ["faculty"] = "faculty",
        ["student_id"] = "student_id",
        ["student id"] = "student_id",
        ["student no"] = "student_id",
        ["student number"] = "student_id",
        ["degree_programme"] = "degree_programme",
        ["degree programme"] = "degree_programme",
        ["university"] = "university",
        ["title"] = "title",
        ["full_name"] = "full_name",
        ["full name"] = "full_name",
        ["name with initials"] = "full_name",
        ["gender"] = "gender",
        ["nic"] = "nic",
        ["nic/passport"] = "nic",
        ["passport"] = "nic",
        ["mobile"] = "mobile",
        ["mobile no"] = "mobile",
        ["mobile number"] = "mobile",
        ["email"] = "email",
        ["e-mail"] = "email",
        ["house_name"] = "house_name",
        ["house"] = "house_name",
    };

    [GeneratedRegex(@"[,\s]")]
    private static partial Regex PhoneStrip();

    public static string NormalizePhone(string value) => PhoneStrip().Replace(value, "").Trim();

    /// <summary>Name with Initials only — Title stays in its own column (matches NSBM export).</summary>
    public static string BuildFullName(IReadOnlyDictionary<string, string> row)
    {
        var name = row.GetValueOrDefault("full_name")?.Trim() ?? "";
        if (name.Length > 0) return name;
        var email = row.GetValueOrDefault("email")?.Trim();
        if (!string.IsNullOrEmpty(email)) return email.Split('@')[0];
        var sid = row.GetValueOrDefault("student_id")?.Trim();
        if (!string.IsNullOrEmpty(sid)) return $"Student {sid}";
        return "";
    }

    public static Dictionary<string, string> NormalizeRow(IReadOnlyDictionary<string, string> raw)
    {
        var output = new Dictionary<string, string>();
        foreach (var (key, value) in raw)
        {
            if (HeaderAliases.TryGetValue(key.Trim().ToLowerInvariant(), out var alias))
            {
                var v = (value ?? "").Trim();
                if (v.Length > 0) output[alias] = v;
            }
        }

        if (output.TryGetValue("mobile", out var mobile)) output["mobile"] = NormalizePhone(mobile);
        if (output.TryGetValue("nic", out var nic)) output["nic"] = nic.Replace(",", "").Trim();
        if (output.TryGetValue("faculty", out var faculty))
        {
            var normalized = Faculties.NormalizeCode(faculty);
            output["faculty"] = normalized.Length > 0 ? normalized : faculty;
        }

        var fullName = BuildFullName(output);
        if (fullName.Length > 0) output["full_name"] = fullName;

        return output;
    }
}
