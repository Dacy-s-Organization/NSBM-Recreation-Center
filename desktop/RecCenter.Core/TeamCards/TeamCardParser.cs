using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using RecCenter.Core.Domain;

namespace RecCenter.Core.TeamCards;

public sealed record OcrWord(string Text, double X, double Y, double Width, double Height);

public sealed record TeamCardRow(string StudentId, string FullName, string? JerseyNo);

public sealed record TeamCardExtract(string? Section, string SourceKind, List<TeamCardRow> Rows, List<string> Warnings);

public static class TeamCardParser
{
    private sealed record Heading(string Role, string Phrase, bool Fiesta, bool Inter);

    private static readonly Heading[] Headings =
    {
        new("name", "name of athlete", true, false),
        new("name", "player s full name", false, false),
        new("name", "players full name", false, false),
        new("name", "name", false, false),
        new("id", "university student id", false, true),
        new("id", "university student io", false, true),
        new("id", "umis id", true, false),
        new("id", "student id", false, true),
        new("id", "student io", false, true),
        new("jersey", "jersey no", false, true),
        new("jersey", "jorsey no", false, true),
        new("jersey", "jersey", false, true),
        new("jersey", "jorsey", false, true),
    };

    public static string? SourceKindFor(string fileName)
    {
        var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
        return ext switch
        {
            "docx" => "docx",
            "xlsx" => "xlsx",
            "csv" => "csv",
            "jpg" or "jpeg" or "png" or "webp" or "heic" or "heif" => "image",
            _ => null,
        };
    }

    public static TeamCardExtract ExtractOffice(string fileName, byte[] bytes)
    {
        var kind = SourceKindFor(fileName) ?? throw new InvalidDataException("Use a Word, Excel, or CSV team card.");
        var (tables, text) = kind switch
        {
            "docx" => ReadDocx(bytes),
            "xlsx" => ReadXlsx(bytes),
            "csv" => ReadCsv(bytes),
            _ => throw new InvalidDataException("Use a Word, Excel, or CSV team card."),
        };
        var parsed = RowsFromTables(tables);
        return Build(kind, text, parsed.Rows, parsed.Flags, new List<string>());
    }

    public static TeamCardExtract ExtractOcr(IReadOnlyList<OcrWord> words) =>
        ExtractOcrPasses(new[] { words });

    public static TeamCardExtract ExtractOcrPasses(IReadOnlyList<IReadOnlyList<OcrWord>> passes)
    {
        var slots = new List<RankedRow>();
        string? section = null;
        var warningLines = new List<string>();
        var cleanOrphans = new List<(string Name, double Rank)>();
        foreach (var pass in passes)
        {
            var parsed = RowsFromOcr(pass);
            var accepted = new List<int>();
            var text = string.Join(" ", pass.Select(word => word.Text));
            var extract = Build("image", text, parsed.Rows, parsed.Flags, parsed.Warnings, accepted);
            section ??= extract.Section;
            warningLines.AddRange(extract.Warnings);
            var maxY = parsed.Ys.Count == 0 ? 1d : parsed.Ys.Max();
            if (maxY <= 0) maxY = 1d;
            for (var i = 0; i < extract.Rows.Count; i++)
            {
                var row = extract.Rows[i];
                var rank = parsed.Ys[accepted[i]] / maxY;
                var score = row.FullName.Count(char.IsLetter);
                var index = slots.FindIndex(existing => existing.Id == row.StudentId
                    || existing.Id.StartsWith(row.StudentId, StringComparison.Ordinal)
                    || row.StudentId.StartsWith(existing.Id, StringComparison.Ordinal));
                if (index < 0)
                {
                    slots.Add(new RankedRow(row.StudentId, row.FullName, row.JerseyNo, rank, score));
                    continue;
                }
                var current = slots[index];
                slots[index] = new RankedRow(
                    row.StudentId.Length >= current.Id.Length ? row.StudentId : current.Id,
                    score > current.Score ? row.FullName : current.Name,
                    row.JerseyNo ?? current.Jersey,
                    Math.Min(current.Rank, rank),
                    Math.Max(current.Score, score));
            }

            var orphans = new List<(string Name, double Rank)>();
            for (var index = 0; index < parsed.Rows.Count; index++)
            {
                var name = System.Text.RegularExpressions.Regex.Replace(Collapse(parsed.Rows[index].ElementAtOrDefault(0) ?? ""), @"^\d{1,2}\s+", "");
                if (name.Length == 0 || !name.Any(char.IsLetter)) continue;
                if (name.Any(ch => !char.IsLetter(ch) && ch is not '.' and not ' ' and not ',')) continue;
                if (StudentIdFrom(parsed.Rows[index].ElementAtOrDefault(1) ?? "") is not null) continue;
                orphans.Add((name, parsed.Ys[index] / maxY));
            }
            if (orphans.Count > 0) cleanOrphans.AddRange(orphans);
        }

        for (var index = 0; index < slots.Count; index++)
        {
            if (slots[index].Name.Any(char.IsLetter)) continue;
            var slot = slots[index];
            (string Name, double Rank) best = default;
            var bestLetters = 0;
            var bestGap = 0.02;
            foreach (var orphan in cleanOrphans)
            {
                var gap = Math.Abs(orphan.Rank - slot.Rank);
                var letters = orphan.Name.Count(char.IsLetter);
                if (gap < 0.02 && (letters > bestLetters || (letters == bestLetters && gap < bestGap)))
                {
                    bestLetters = letters;
                    bestGap = gap;
                    best = orphan;
                }
            }
            if (best.Name is null) continue;
            slots[index] = slot with { Name = best.Name, Score = best.Name.Count(char.IsLetter) };
        }

        slots.Sort((a, b) => a.Rank.CompareTo(b.Rank));
        var rows = slots.Select(slot => new TeamCardRow(slot.Id, slot.Name, slot.Jersey)).ToList();
        var warnings = warningLines
            .Where(warning => warning.StartsWith("Skipped", StringComparison.Ordinal) && !Recovered(warning, rows))
            .Where(warning =>
            {
                var quoted = System.Text.RegularExpressions.Regex.Match(warning, "“(.+?)”");
                return quoted.Success
                    && quoted.Groups[1].Value.Length <= 42
                    && quoted.Groups[1].Value.Any(char.IsLetter)
                    && !System.Text.RegularExpressions.Regex.IsMatch(quoted.Groups[1].Value, "declaration|signature|contact|official|certify|enrolled|permitted|hereby", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            })
            .Distinct()
            .ToList();
        return new TeamCardExtract(section, "image", rows, warnings);
    }

    private static bool Recovered(string warning, List<TeamCardRow> rows)
    {
        var match = System.Text.RegularExpressions.Regex.Match(warning, "“(.+?)”");
        if (!match.Success) return false;
        var tokens = System.Text.RegularExpressions.Regex.Matches(match.Groups[1].Value, @"[A-Za-z]{4,}")
            .Select(item => item.Value.ToLowerInvariant());
        return tokens.Any(token => rows.Any(row => row.FullName.Contains(token, StringComparison.OrdinalIgnoreCase)));
    }

    private readonly record struct RankedRow(string Id, string Name, string? Jersey, double Rank, int Score);

    private static TeamCardExtract Build(
        string sourceKind,
        string text,
        List<string[]> rows,
        HeadingFlags flags,
        List<string> warnings,
        List<int>? accepted = null)
    {
        var kept = new List<TeamCardRow>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            var fullName = System.Text.RegularExpressions.Regex.Replace(Collapse(row.ElementAtOrDefault(0) ?? ""), @"^\d{1,2}\s+", "");
            var studentId = StudentIdFrom(row.ElementAtOrDefault(1) ?? "");
            var jerseyCell = row.ElementAtOrDefault(2) ?? "";
            if (fullName.Length == 0 && studentId is null) continue;
            if (studentId is null)
            {
                if (fullName.Length > 0)
                    warnings.Add($"Skipped “{fullName}” because the student ID was missing or not 4 to 6 digits.");
                continue;
            }
            if (fullName.Length == 0)
            {
                warnings.Add($"Skipped student ID {studentId} because the name was empty.");
                continue;
            }
            if (!seen.Add(studentId))
            {
                warnings.Add($"Student ID {studentId} was listed more than once. The first row was kept.");
                continue;
            }
            var jersey = JerseyFrom(jerseyCell);
            if (jerseyCell.Trim().Length > 0 && jersey is null)
                warnings.Add($"Jersey for {studentId} was not a 1 to 3 digit number, so it was left blank.");
            kept.Add(new TeamCardRow(studentId, fullName, jersey));
            accepted?.Add(index);
        }

        return new TeamCardExtract(DetectSection(text, flags), sourceKind, kept, warnings);
    }

    private static (List<string[][]> Tables, string Text) ReadDocx(byte[] bytes)
    {
        var xml = EntryText(bytes, "word/document.xml") ?? throw new InvalidDataException("This file does not contain a readable table.");
        var doc = XDocument.Parse(xml);
        var text = string.Join(" ", doc.Descendants().Where(el => el.Name.LocalName == "t").Select(el => el.Value));
        var tables = new List<string[][]>();
        foreach (var table in doc.Descendants().Where(el => el.Name.LocalName == "tbl"))
        {
            var rows = new List<string[]>();
            foreach (var row in table.Elements().Where(el => el.Name.LocalName == "tr"))
            {
                var cells = row.Elements().Where(el => el.Name.LocalName == "tc")
                    .Select(cell => Collapse(string.Concat(cell.Descendants().Where(el => el.Name.LocalName == "t").Select(el => el.Value))))
                    .ToArray();
                if (cells.Length > 0) rows.Add(cells);
            }
            if (rows.Count > 0) tables.Add(rows.ToArray());
        }
        return (tables, text);
    }

    private static (List<string[][]> Tables, string Text) ReadXlsx(byte[] bytes)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var sheet = zip.Entries
            .Select(entry => entry.FullName.Replace('\\', '/'))
            .Where(name => Regex.IsMatch(name, @"^xl/worksheets/sheet\d+\.xml$", RegexOptions.IgnoreCase))
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault();
        var xml = sheet is null ? null : EntryText(bytes, sheet);
        if (xml is null) throw new InvalidDataException("This workbook does not contain a readable sheet.");
        var sharedXml = EntryText(bytes, "xl/sharedStrings.xml");
        var shared = sharedXml is null ? new List<string>() : SharedStrings(sharedXml);
        var doc = XDocument.Parse(xml);
        var rows = new List<string[]>();
        foreach (var row in doc.Descendants().Where(el => el.Name.LocalName == "row"))
        {
            var cells = new List<string>();
            foreach (var cell in row.Elements().Where(el => el.Name.LocalName == "c"))
            {
                var reference = (string?)cell.Attribute("r") ?? "";
                var index = ColumnIndex(reference);
                if (index < 0) index = cells.Count;
                var kind = (string?)cell.Attribute("t") ?? "";
                string value;
                if (kind == "inlineStr")
                    value = string.Concat(cell.Descendants().Where(el => el.Name.LocalName == "t").Select(el => el.Value));
                else
                {
                    var raw = cell.Elements().FirstOrDefault(el => el.Name.LocalName == "v")?.Value ?? "";
                    value = kind == "s" && int.TryParse(raw, out var sharedIndex) && sharedIndex >= 0 && sharedIndex < shared.Count
                        ? shared[sharedIndex]
                        : raw;
                }
                while (cells.Count < index) cells.Add("");
                if (cells.Count == index) cells.Add(Collapse(value));
                else cells[index] = Collapse(value);
            }
            if (cells.Any(cell => cell.Length > 0)) rows.Add(cells.ToArray());
        }
        var text = string.Join(" ", rows.SelectMany(row => row));
        return (rows.Count == 0 ? new List<string[][]>() : new List<string[][]> { rows.ToArray() }, text);
    }

    private static List<string> SharedStrings(string xml)
    {
        var doc = XDocument.Parse(xml);
        return doc.Descendants().Where(el => el.Name.LocalName == "si")
            .Select(item => string.Concat(item.Descendants().Where(el => el.Name.LocalName == "t").Select(el => el.Value)))
            .ToList();
    }

    private static (List<string[][]> Tables, string Text) ReadCsv(byte[] bytes)
    {
        var rows = CsvParser.ParseRows(Encoding.UTF8.GetString(bytes))
            .Select(row => row.Select(Collapse).ToArray())
            .Where(row => row.Any(cell => cell.Length > 0))
            .ToArray();
        var text = string.Join(" ", rows.SelectMany(row => row));
        return (rows.Length == 0 ? new List<string[][]>() : new List<string[][]> { rows }, text);
    }

    private static string? EntryText(byte[] bytes, string name)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var entry = zip.GetEntry(name) ?? zip.GetEntry(name.Replace('/', '\\'));
        if (entry is null) return null;
        using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
        return reader.ReadToEnd();
    }

    private static (List<string[]> Rows, HeadingFlags Flags) RowsFromTables(List<string[][]> tables)
    {
        var flags = new HeadingFlags();
        var rows = new List<string[]>();
        ColumnMap? header = null;
        var width = 0;
        foreach (var table in tables)
        {
            ColumnMap? tableHeader = null;
            foreach (var cells in table)
            {
                var found = MapHeader(cells);
                if (found is not null)
                {
                    tableHeader = found;
                    header = found;
                    width = cells.Length;
                    flags.Or(found.Flags);
                    continue;
                }
                var active = tableHeader ?? (cells.Length == width ? header : null);
                if (active is null) continue;
                rows.Add(new[]
                {
                    Cell(cells, active.Name),
                    Cell(cells, active.Id),
                    active.Jersey is null ? "" : Cell(cells, active.Jersey.Value),
                });
            }
        }
        return (rows, flags);
    }

    private static (List<string[]> Rows, List<double> Ys, HeadingFlags Flags, List<string> Warnings) RowsFromOcr(IReadOnlyList<OcrWord> words)
    {
        var groups = GroupWords(words);
        List<ColumnSpan>? header = null;
        var flags = new HeadingFlags();
        var rows = new List<string[]>();
        var ys = new List<double>();
        foreach (var group in groups)
        {
            var placed = group.OrderBy(word => word.X).ToList();
            var spans = FindHeadingSpans(placed);
            var name = spans.Found.FirstOrDefault(item => item.Role == "name");
            var id = spans.Found.FirstOrDefault(item => item.Role == "id");
            if (name is not null && id is not null && header is null)
            {
                var jersey = spans.Found.FirstOrDefault(item => item.Role == "jersey");
                var columns = new List<HeadingSpan> { name, id };
                if (jersey is not null) columns.Add(jersey);
                columns.Sort((a, b) => a.X.CompareTo(b.X));
                header = columns.Select((column, index) =>
                {
                    var previous = index > 0 ? columns[index - 1] : null;
                    var next = index + 1 < columns.Count ? columns[index + 1] : null;
                    return new ColumnSpan(
                        column.Role,
                        previous is null ? double.NegativeInfinity : (previous.Right + column.X) / 2,
                        next is null ? double.PositiveInfinity : (column.Right + next.X) / 2);
                }).ToList();
                flags.Or(spans.Flags);
                continue;
            }
            if (header is null) continue;
            var cells = new Dictionary<string, List<string>> { ["name"] = new(), ["id"] = new(), ["jersey"] = new() };
            foreach (var word in placed)
            {
                var center = word.X + word.Width / 2;
                var column = header.FirstOrDefault(item => center >= item.Left && center < item.Right);
                if (column is null) continue;
                cells[column.Role].Add(word.Text.Trim());
            }
            rows.Add(new[] { string.Join(" ", cells["name"]), string.Join(" ", cells["id"]), string.Join(" ", cells["jersey"]) });
            ys.Add(group.Average(word => word.Y));
        }
        var warnings = header is null
            ? new List<string> { "Could not find the name and student ID headings on this image." }
            : new List<string>();
        return (rows, ys, flags, warnings);
    }

    private static List<List<OcrWord>> GroupWords(IReadOnlyList<OcrWord> words)
    {
        var sorted = words.Where(word => word.Text.Trim().Length > 0).OrderBy(word => word.Y).ThenBy(word => word.X).ToList();
        var heights = sorted.Select(word => word.Height).Where(height => height > 0).OrderBy(height => height).ToList();
        var median = heights.Count == 0 ? 12 : heights[heights.Count / 2];
        var groups = new List<List<OcrWord>>();
        foreach (var word in sorted)
        {
            if (groups.Count == 0)
            {
                groups.Add(new List<OcrWord> { word });
                continue;
            }
            var current = groups[^1];
            var bottom = current.Max(item => item.Y + item.Height);
            var center = word.Y + word.Height / 2;
            if (center <= bottom + median * 0.45) current.Add(word);
            else groups.Add(new List<OcrWord> { word });
        }
        return groups;
    }

    private static (List<HeadingSpan> Found, HeadingFlags Flags) FindHeadingSpans(List<OcrWord> words)
    {
        var flags = new HeadingFlags();
        var found = new List<HeadingSpan>();
        var acc = "";
        var start = 0;
        for (var i = 0; i < words.Count; i++)
        {
            var piece = Norm(words[i].Text);
            if (piece.Length == 0) continue;
            if (acc.Length == 0) start = i;
            acc = acc.Length == 0 ? piece : acc + " " + piece;
            var hit = Headings
                .Where(heading => acc == heading.Phrase || acc.EndsWith(" " + heading.Phrase, StringComparison.Ordinal))
                .OrderByDescending(heading => heading.Phrase.Length)
                .FirstOrDefault();
            if (hit is null || found.Any(item => item.Role == hit.Role))
            {
                if (hit is not null) acc = "";
                continue;
            }
            var index = PhraseStart(words, start, i, hit.Phrase);
            found.Add(new HeadingSpan(hit.Role, words[index].X, words[i].X + words[i].Width));
            if (hit.Phrase == "name of athlete") flags.NameOfAthlete = true;
            if (hit.Phrase == "umis id") flags.Umis = true;
            if (hit.Inter && hit.Role == "id") flags.StudentId = true;
            if (hit.Role == "jersey") flags.Jersey = true;
            acc = "";
        }
        return (found, flags);
    }

    private static int PhraseStart(List<OcrWord> words, int start, int endIndex, string phrase)
    {
        var acc = "";
        for (var index = endIndex; index >= start; index--)
        {
            var piece = Norm(words[index].Text);
            if (piece.Length == 0) continue;
            acc = acc.Length == 0 ? piece : piece + " " + acc;
            if (acc == phrase) return index;
        }
        return endIndex;
    }

    private static ColumnMap? MapHeader(string[] cells)
    {
        var roles = new Dictionary<string, int>();
        var flags = new HeadingFlags();
        for (var i = 0; i < cells.Length; i++)
        {
            var heading = Headings.FirstOrDefault(item => item.Phrase == Norm(cells[i]));
            if (heading is null || roles.ContainsKey(heading.Role)) continue;
            roles[heading.Role] = i;
            if (heading.Phrase == "name of athlete") flags.NameOfAthlete = true;
            if (heading.Phrase == "umis id") flags.Umis = true;
            if (heading.Inter && heading.Role == "id") flags.StudentId = true;
            if (heading.Role == "jersey") flags.Jersey = true;
        }
        if (!roles.TryGetValue("name", out var name) || !roles.TryGetValue("id", out var id)) return null;
        return new ColumnMap(name, id, roles.TryGetValue("jersey", out var jersey) ? jersey : null, flags);
    }

    private static string? DetectSection(string text, HeadingFlags flags)
    {
        var upper = text.ToUpperInvariant();
        var fiesta = upper.Contains("SPORTS FIESTA", StringComparison.Ordinal) || upper.Contains("ENTRY FORM", StringComparison.Ordinal)
            || (flags.NameOfAthlete && flags.Umis);
        var inter = upper.Contains("OFFICIAL TEAM CARD", StringComparison.Ordinal) || (flags.StudentId && flags.Jersey);
        if (fiesta == inter) return null;
        return fiesta ? "sports-fiesta" : "inter-university";
    }

    private static string? StudentIdFrom(string value)
    {
        var compact = Regex.Replace(value, @"\s+", "");
        var direct = DigitsOnly(compact);
        if (direct is not null) return direct;
        var match = Regex.Match(value, @"\b(\d{4,6})\b");
        return match.Success ? match.Groups[1].Value : null;
    }

    private static string? DigitsOnly(string value)
    {
        value = value.Replace("€", "3").Trim('\'', '’', '"', '•', '.');
        if (Regex.IsMatch(value, @"^\d{4,6}$")) return value;
        if (!Regex.IsMatch(value, @"^[0-9A-Za-z|öÖ]{4,6}$")) return null;
        var repaired = value
            .Replace('O', '0').Replace('o', '0').Replace('Q', '0')
            .Replace('I', '1').Replace('l', '1').Replace('|', '1').Replace('i', '1')
            .Replace('Z', '2').Replace('z', '2')
            .Replace('A', '3').Replace('a', '3')
            .Replace('S', '5').Replace('s', '5')
            .Replace('G', '6').Replace('g', '6').Replace('ö', '6').Replace('Ö', '6')
            .Replace('B', '8')
            .Replace('e', '9').Replace('q', '9');
        return Regex.IsMatch(repaired, @"^\d{4,6}$") ? repaired : null;
    }

    private static string? JerseyFrom(string value)
    {
        var compact = Regex.Replace(value, @"\s+", "");
        return Regex.IsMatch(compact, @"^\d{1,3}$") ? compact : null;
    }

    public static string Norm(string value)
    {
        var lower = value.ToLowerInvariant();
        var cleaned = Regex.Replace(lower, @"[^a-z0-9]+", " ");
        return Regex.Replace(cleaned, @"\s+", " ").Trim();
    }

    private static string Collapse(string value) => Regex.Replace(value, @"\s+", " ").Trim();

    private static string Cell(string[] cells, int index) => index >= 0 && index < cells.Length ? cells[index] : "";

    private static int ColumnIndex(string reference)
    {
        var index = 0;
        foreach (var ch in reference)
        {
            if (!char.IsLetter(ch)) break;
            index = index * 26 + char.ToUpperInvariant(ch) - 64;
        }
        return index - 1;
    }

    private sealed class HeadingFlags
    {
        public bool NameOfAthlete { get; set; }
        public bool Umis { get; set; }
        public bool StudentId { get; set; }
        public bool Jersey { get; set; }

        public void Or(HeadingFlags other)
        {
            NameOfAthlete |= other.NameOfAthlete;
            Umis |= other.Umis;
            StudentId |= other.StudentId;
            Jersey |= other.Jersey;
        }
    }

    private sealed record ColumnMap(int Name, int Id, int? Jersey, HeadingFlags Flags);
    private sealed record HeadingSpan(string Role, double X, double Right);
    private sealed record ColumnSpan(string Role, double Left, double Right);
}
