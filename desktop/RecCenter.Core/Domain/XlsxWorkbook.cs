using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace RecCenter.Core.Domain;

/// <summary>Reads every worksheet of an xlsx file, in workbook order.</summary>
public static partial class XlsxWorkbook
{
    public sealed record GridRow(int Line, IReadOnlyList<string> Cells);
    public sealed record Sheet(string Name, IReadOnlyList<GridRow> Rows);

    [GeneratedRegex(@"^[-+]?\d+\.0+$")]
    private static partial Regex TrailingZero();

    [GeneratedRegex(@"^[-+]?(?:\d+\.?\d*|\.\d+)[eE][-+]?\d+$")]
    private static partial Regex Scientific();

    /// <summary>Integers stored as 1.23E+4 become plain digits. Values past the safe integer range stay as written.</summary>
    public static string PlainNumber(string raw)
    {
        var text = raw.Trim();
        if (TrailingZero().IsMatch(text)) return text[..text.IndexOf('.')].TrimStart('+');
        if (!Scientific().IsMatch(text)) return text;
        if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)) return text;
        if (value != Math.Truncate(value) || Math.Abs(value) > 9007199254740991d) return text;
        return ((long)value).ToString(CultureInfo.InvariantCulture);
    }

    public static List<Sheet> Read(byte[] bytes)
    {
        Dictionary<string, string> files;
        try
        {
            files = ReadZip(bytes);
        }
        catch (Exception ex) when (ex is InvalidDataException or IOException)
        {
            throw new InvalidDataException("This Excel file could not be read.");
        }

        var workbook = ZipText(files, "xl/workbook.xml");
        var rels = ZipText(files, "xl/_rels/workbook.xml.rels");
        if (workbook is null || rels is null) throw new InvalidDataException("This workbook does not contain a readable sheet.");

        var targets = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var rel in XDocument.Parse(rels).Descendants().Where(el => el.Name.LocalName == "Relationship"))
        {
            var id = (string?)rel.Attribute("Id") ?? "";
            var target = (string?)rel.Attribute("Target") ?? "";
            if (id.Length > 0 && target.Length > 0) targets[id] = ResolveTarget(target);
        }

        var shared = SharedStrings(ZipText(files, "xl/sharedStrings.xml"));
        var sheets = new List<Sheet>();
        foreach (var sheet in XDocument.Parse(workbook).Descendants().Where(el => el.Name.LocalName == "sheet"))
        {
            var name = (string?)sheet.Attribute("name") ?? "";
            var id = sheet.Attributes().FirstOrDefault(attribute => attribute.Name.LocalName == "id")?.Value ?? "";
            var target = targets.GetValueOrDefault(id);
            var xml = target is null ? null : ZipText(files, target);
            if (name.Length == 0 || xml is null) throw new InvalidDataException($"Sheet \"{(name.Length == 0 ? id : name)}\" could not be read.");
            sheets.Add(new Sheet(name, SheetRows(xml, shared)));
        }
        if (sheets.Count == 0) throw new InvalidDataException("This workbook does not contain a readable sheet.");
        return sheets;
    }

    private static Dictionary<string, string> ReadZip(byte[] bytes)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        var files = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in zip.Entries)
        {
            using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
            files[entry.FullName.Replace('\\', '/')] = reader.ReadToEnd();
        }
        return files;
    }

    private static string? ZipText(Dictionary<string, string> files, string name)
    {
        var wanted = name.Replace('\\', '/').TrimStart('/');
        return files.TryGetValue(wanted, out var text) ? text : null;
    }

    private static string ResolveTarget(string target)
    {
        var cleaned = target.Replace('\\', '/');
        if (cleaned.StartsWith('/')) return cleaned.TrimStart('/');
        var stack = new List<string>();
        foreach (var part in new[] { "xl" }.Concat(cleaned.Split('/')))
        {
            if (part == "..")
            {
                if (stack.Count > 0) stack.RemoveAt(stack.Count - 1);
            }
            else if (part != "." && part.Length > 0)
            {
                stack.Add(part);
            }
        }
        return string.Join("/", stack);
    }

    private static List<string> SharedStrings(string? xml)
    {
        if (string.IsNullOrEmpty(xml)) return new();
        return XDocument.Parse(xml).Descendants()
            .Where(el => el.Name.LocalName == "si")
            .Select(ItemText)
            .ToList();
    }

    private static string ItemText(XElement item) =>
        string.Concat(item.Descendants()
            .Where(el => el.Name.LocalName == "t" && !el.Ancestors().Any(ancestor => ancestor.Name.LocalName == "rPh"))
            .Select(el => el.Value));

    private static List<GridRow> SheetRows(string xml, List<string> shared)
    {
        var rows = new List<GridRow>();
        var fallbackLine = 0;
        foreach (var row in XDocument.Parse(xml).Descendants().Where(el => el.Name.LocalName == "row"))
        {
            fallbackLine++;
            var lineText = (string?)row.Attribute("r");
            var line = int.TryParse(lineText, out var parsed) && parsed > 0 ? parsed : fallbackLine;
            var cells = new List<string>();
            var fallbackColumn = 0;
            foreach (var cell in row.Elements().Where(el => el.Name.LocalName == "c"))
            {
                var reference = (string?)cell.Attribute("r") ?? "";
                var column = ColumnIndex(reference) ?? fallbackColumn;
                var kind = (string?)cell.Attribute("t") ?? "";
                var value = CellValue(cell, kind, shared);
                while (cells.Count < column) cells.Add("");
                if (cells.Count == column) cells.Add(value);
                else cells[column] = value;
                fallbackColumn = column + 1;
            }
            if (cells.Any(cell => cell.Length > 0)) rows.Add(new GridRow(line, cells));
        }
        return rows;
    }

    private static string CellValue(XElement cell, string kind, List<string> shared)
    {
        if (kind == "inlineStr") return ItemText(cell).Trim();
        if (kind == "e") return "";
        var raw = cell.Elements().FirstOrDefault(el => el.Name.LocalName == "v")?.Value ?? "";
        if (kind == "s" && int.TryParse(raw, out var index) && index >= 0 && index < shared.Count) return shared[index].Trim();
        if (kind == "b") return raw == "1" ? "TRUE" : raw == "0" ? "FALSE" : raw.Trim();
        return PlainNumber(raw).Trim();
    }

    private static int? ColumnIndex(string reference)
    {
        var letters = 0;
        foreach (var ch in reference)
        {
            if (ch is >= 'A' and <= 'Z' or >= 'a' and <= 'z') letters++;
            else break;
        }
        if (letters == 0) return null;
        var index = 0;
        foreach (var ch in reference[..letters].ToUpperInvariant()) index = index * 26 + ch - 'A' + 1;
        return index - 1;
    }
}
