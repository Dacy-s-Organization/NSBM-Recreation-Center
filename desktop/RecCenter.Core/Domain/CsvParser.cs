using System.Text;

namespace RecCenter.Core.Domain;

/// <summary>RFC 4180 CSV reader with a header row, matching PapaParse's <c>header: true, skipEmptyLines: true</c>.</summary>
public static class CsvParser
{
    public static List<Dictionary<string, string>> ParseWithHeader(string text)
    {
        if (text.Length > 0 && text[0] == '\uFEFF') text = text[1..];

        var records = ReadRecords(text);
        var result = new List<Dictionary<string, string>>();
        if (records.Count == 0) return result;

        var headers = records[0];
        for (var r = 1; r < records.Count; r++)
        {
            var fields = records[r];
            if (fields.Count == 1 && fields[0].Length == 0) continue;

            var row = new Dictionary<string, string>();
            for (var i = 0; i < headers.Count; i++)
            {
                if (i < fields.Count) row[headers[i]] = fields[i];
            }
            result.Add(row);
        }
        return result;
    }

    private static List<List<string>> ReadRecords(string text)
    {
        var records = new List<List<string>>();
        var fields = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;
        var i = 0;

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

            switch (c)
            {
                case '"' when field.Length == 0:
                    inQuotes = true;
                    i++;
                    break;
                case ',':
                    fields.Add(field.ToString());
                    field.Clear();
                    i++;
                    break;
                case '\r':
                case '\n':
                    fields.Add(field.ToString());
                    field.Clear();
                    records.Add(fields);
                    fields = new List<string>();
                    i += c == '\r' && i + 1 < text.Length && text[i + 1] == '\n' ? 2 : 1;
                    break;
                default:
                    field.Append(c);
                    i++;
                    break;
            }
        }

        if (field.Length > 0 || fields.Count > 0)
        {
            fields.Add(field.ToString());
            records.Add(fields);
        }
        return records;
    }
}
