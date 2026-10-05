using System.Text;

namespace RecCenter.Core.Domain;

/// <summary>
/// Reads a student .xlsx or .csv file. Faculty-named sheets win over sheets such as All,
/// blanks are filled from the other sheets, and conflicting values are reported.
/// </summary>
public static class StudentWorkbook
{
    private static readonly HashSet<string> HeaderMarkers = new(StringComparer.OrdinalIgnoreCase)
    {
        "student no", "student id", "student number", "student_id", "name with initials",
    };

    private static readonly string[] MergeFields =
    {
        "serial_no", "faculty", "student_id", "degree_programme", "university", "title",
        "full_name", "gender", "nic", "mobile", "email", "house_name",
    };

    public sealed record Issue(string Sheet, int Line, string Message);

    public sealed class ReadResult
    {
        public List<Dictionary<string, string>> Rows { get; } = new();
        public List<Issue> Issues { get; } = new();
        public List<string> SkippedSheets { get; } = new();
    }

    private sealed class Sourced
    {
        public string Sheet { get; init; } = "";
        public int Line { get; init; }
        public string FacultySheet { get; init; } = "";
        public string StudentId { get; init; } = "";
        public Dictionary<string, string> Row { get; init; } = new();
        public string? Invalid { get; init; }
    }

    public static ReadResult Read(string fileName, byte[] bytes)
    {
        var lower = fileName.Trim().ToLowerInvariant();
        if (lower.EndsWith(".csv"))
        {
            var text = Encoding.UTF8.GetString(bytes);
            return Finish(new[] { new XlsxWorkbook.Sheet("CSV", ReadCsvRows(text)) });
        }
        if (lower.EndsWith(".xlsx")) return Finish(XlsxWorkbook.Read(bytes));
        throw new InvalidDataException("Upload an Excel workbook (.xlsx) or a CSV file.");
    }

    public static List<(string Faculty, int Count)> CountByFaculty(IEnumerable<Dictionary<string, string>> rows)
    {
        var counts = new Dictionary<string, int>();
        foreach (var row in rows)
        {
            var faculty = row.GetValueOrDefault("faculty")?.Trim() ?? "";
            counts[faculty] = counts.GetValueOrDefault(faculty) + 1;
        }
        var order = Faculties.All.Select(faculty => faculty.Code).ToList();
        return counts
            .OrderBy(pair =>
            {
                var index = order.IndexOf(pair.Key);
                return index < 0 ? 99 : index;
            })
            .ThenBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => (pair.Key, pair.Value))
            .ToList();
    }

    private static ReadResult Finish(IReadOnlyList<XlsxWorkbook.Sheet> sheets)
    {
        var (sources, skipped) = SourceRows(sheets);
        var result = new ReadResult();
        result.SkippedSheets.AddRange(skipped);
        var tainted = new HashSet<string>();
        var grouped = new Dictionary<string, List<Sourced>>();
        var withoutId = new List<Sourced>();

        foreach (var source in sources)
        {
            if (source.Invalid is not null)
            {
                result.Issues.Add(new Issue(source.Sheet, source.Line, source.Invalid));
                if (source.StudentId.Length > 0) tainted.Add(source.StudentId);
                continue;
            }
            if (source.StudentId.Length > 0)
            {
                if (!grouped.TryGetValue(source.StudentId, out var group))
                {
                    group = new List<Sourced>();
                    grouped[source.StudentId] = group;
                }
                group.Add(source);
            }
            else
            {
                withoutId.Add(source);
            }
        }

        foreach (var (studentId, group) in grouped)
        {
            var first = group[0];
            if (tainted.Contains(studentId))
            {
                result.Issues.Add(new Issue(first.Sheet, first.Line, $"Student {studentId}: not imported because another row in this file is invalid."));
                continue;
            }
            var (row, message) = MergeGroup(group);
            Accept(result, first, row, message);
        }
        foreach (var source in withoutId)
        {
            var (row, message) = MergeGroup(new[] { source });
            Accept(result, source, row, message);
        }
        return result;
    }

    private static void Accept(ReadResult result, Sourced source, Dictionary<string, string>? row, string? message)
    {
        if (message is not null) result.Issues.Add(new Issue(source.Sheet, source.Line, message));
        else if (row is not null) result.Rows.Add(row);
    }

    private static (List<Sourced> Sources, List<string> Skipped) SourceRows(IReadOnlyList<XlsxWorkbook.Sheet> sheets)
    {
        var sources = new List<Sourced>();
        var skipped = new List<string>();
        foreach (var sheet in sheets)
        {
            var headerIndex = -1;
            for (var i = 0; i < sheet.Rows.Count; i++)
            {
                if (sheet.Rows[i].Cells.Any(cell => HeaderMarkers.Contains(cell.Trim())))
                {
                    headerIndex = i;
                    break;
                }
            }
            if (headerIndex < 0)
            {
                skipped.Add(sheet.Name);
                continue;
            }
            var headers = sheet.Rows[headerIndex].Cells;
            var facultySheet = Faculties.IsNsbmCode(sheet.Name) ? Faculties.NormalizeCode(sheet.Name) : "";
            for (var i = headerIndex + 1; i < sheet.Rows.Count; i++)
            {
                var grid = sheet.Rows[i];
                var raw = RawFromRow(headers, grid.Cells);
                if (raw.Count == 0) continue;
                var explicitName = StudentCsv.HasExplicitName(raw);
                var row = StudentCsv.NormalizeRow(raw);
                if (!explicitName) row.Remove("full_name");
                string? invalid = null;
                if (facultySheet.Length > 0)
                {
                    if (row.TryGetValue("faculty", out var faculty) && faculty.Length > 0 && Faculties.NormalizeCode(faculty) != facultySheet)
                        invalid = $"Faculty \"{faculty}\" does not match sheet \"{sheet.Name}\".";
                    else if (!row.ContainsKey("faculty") || row["faculty"].Length == 0)
                        row["faculty"] = facultySheet;
                }
                sources.Add(new Sourced
                {
                    Sheet = sheet.Name,
                    Line = grid.Line,
                    FacultySheet = facultySheet,
                    StudentId = row.GetValueOrDefault("student_id")?.Trim() ?? "",
                    Row = row,
                    Invalid = invalid,
                });
            }
        }
        return (sources, skipped);
    }

    private static Dictionary<string, string> RawFromRow(IReadOnlyList<string> headers, IReadOnlyList<string> cells)
    {
        var raw = new Dictionary<string, string>();
        for (var i = 0; i < headers.Count; i++)
        {
            var key = headers[i].Trim();
            var value = i < cells.Count ? cells[i].Trim() : "";
            if (key.Length == 0 || value.Length == 0 || raw.ContainsKey(key)) continue;
            raw[key] = value;
        }
        return raw;
    }

    private static List<string> FieldValues(IReadOnlyList<Sourced> sources, string field)
    {
        var values = new List<string>();
        foreach (var source in sources)
        {
            var value = source.Row.GetValueOrDefault(field)?.Trim() ?? "";
            if (value.Length > 0 && !values.Contains(value)) values.Add(value);
        }
        return values;
    }

    private static (Dictionary<string, string>? Row, string? Message) MergeGroup(IReadOnlyList<Sourced> sources)
    {
        var facultySources = sources.Where(source => source.FacultySheet.Length > 0).ToList();
        var primary = facultySources.Count > 0 ? facultySources : sources.ToList();
        var secondary = sources.Where(source => !primary.Contains(source)).ToList();
        var row = new Dictionary<string, string>();
        var conflicts = new List<string>();
        foreach (var field in MergeFields)
        {
            var preferred = FieldValues(primary, field);
            var values = preferred.Count > 0 ? preferred : FieldValues(secondary, field);
            if (values.Count > 1)
            {
                conflicts.Add($"Conflicting {field} ({string.Join(" vs ", values.Select(value => $"\"{value}\""))}).");
                continue;
            }
            if (values.Count == 1) row[field] = values[0];
        }
        var intake = FieldValues(primary, "intake");
        var intakeValue = intake.Count > 0 ? intake[0] : FieldValues(secondary, "intake").FirstOrDefault();
        if (!string.IsNullOrEmpty(intakeValue)) row["intake"] = intakeValue;
        if (conflicts.Count > 0)
        {
            var id = row.GetValueOrDefault("student_id");
            if (string.IsNullOrEmpty(id)) id = sources[0].StudentId;
            var prefix = !string.IsNullOrEmpty(id) ? $"Student {id}: " : $"Row {sources[0].Line}: ";
            return (null, prefix + string.Join(" ", conflicts));
        }
        var fullName = StudentCsv.BuildFullName(row);
        if (fullName.Length > 0) row["full_name"] = fullName;
        if (string.IsNullOrWhiteSpace(row.GetValueOrDefault("full_name")) && string.IsNullOrWhiteSpace(row.GetValueOrDefault("student_id")))
            return (null, "Missing Student ID or name.");
        if (!Faculties.IsNsbmCode(row.GetValueOrDefault("faculty") ?? ""))
            return (null, "No recognised faculty.");
        row["faculty"] = Faculties.NormalizeCode(row["faculty"]);
        return (row, null);
    }

    private static List<XlsxWorkbook.GridRow> ReadCsvRows(string text)
    {
        if (text.Length > 0 && text[0] == '\uFEFF') text = text[1..];
        var rows = new List<XlsxWorkbook.GridRow>();
        var fields = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;
        var line = 1;
        var i = 0;

        void PushField()
        {
            fields.Add(field.ToString());
            field.Clear();
        }

        void PushRow()
        {
            if (fields.Any(cell => cell.Trim().Length > 0) || field.ToString().Trim().Length > 0)
            {
                PushField();
                rows.Add(new XlsxWorkbook.GridRow(line, fields.Select(cell => cell.Trim()).ToList()));
            }
            fields = new List<string>();
            field.Clear();
        }

        while (i < text.Length)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i += 2;
                        continue;
                    }
                    inQuotes = false;
                    i++;
                    continue;
                }
                field.Append(c);
                i++;
                continue;
            }
            if (c == '"' && field.Length == 0)
            {
                inQuotes = true;
                i++;
                continue;
            }
            if (c == ',')
            {
                PushField();
                i++;
                continue;
            }
            if (c is '\r' or '\n')
            {
                PushRow();
                i += c == '\r' && i + 1 < text.Length && text[i + 1] == '\n' ? 2 : 1;
                line++;
                continue;
            }
            field.Append(c);
            i++;
        }
        if (field.Length > 0 || fields.Count > 0) PushRow();
        return rows;
    }
}
