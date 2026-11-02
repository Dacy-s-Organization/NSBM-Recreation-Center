using RecCenter.Core.TeamCards;
using RecCenter.Desktop.Ocr;

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var fixtures = Path.Combine(root, "scripts", "fixtures", "team-cards");

var marathon = Path.Combine(fixtures, "marathon-entry.docx");
var tennis = Path.Combine(fixtures, "table-tennis-entry.docx");
var photo = Path.Combine(fixtures, "team-card.png");

CheckOffice(marathon, "sports-fiesta", 15, new[]
{
    "11001", "11002", "11003", "11004", "11005", "11006", "11007", "11008",
    "11009", "11010", "11011", "11012", "11013", "11014", "11015",
});
CheckOffice(tennis, "sports-fiesta", 3, new[] { "12001", "12002", "12003" });

var csv = """
Event,Name,Student ID,Jersey
Marathon,Sample Athlete,13001,7
Marathon,Test Player,13002,12
Marathon,Sample Athlete,13001,9
""";
var csvExtract = TeamCardParser.ExtractOffice("card.csv", System.Text.Encoding.UTF8.GetBytes(csv));
Expect(csvExtract, "inter-university", 2, new[] { "13001", "13002" });
if (csvExtract.Rows[0].JerseyNo != "7" || csvExtract.Rows[1].JerseyNo != "12")
    throw new Exception("CSV jersey numbers were not read.");
if (csvExtract.Warnings.Count == 0) throw new Exception("CSV duplicate warning missing.");

var ocr = new WindowsOcrService();
var passes = await ocr.RecognizePassesAsync(photo);
var photoExtract = TeamCardParser.ExtractOcrPasses(passes);
Console.WriteLine($"photo section={photoExtract.Section} rows={photoExtract.Rows.Count}");
foreach (var row in photoExtract.Rows)
    Console.WriteLine($"{row.StudentId} | {row.FullName} | {row.JerseyNo}");
foreach (var warning in photoExtract.Warnings)
    Console.WriteLine("warn: " + warning);
if (photoExtract.Section != "inter-university")
    throw new Exception("Photo was not classified as Inter University.");
var expectedPhoto = new[] { "21001", "21002", "21003", "21004", "21005", "21006", "21007", "21008" };
if (!expectedPhoto.SequenceEqual(photoExtract.Rows.Select(row => row.StudentId)))
    throw new Exception("Photo rows did not match the printed team.");
if (!photoExtract.Warnings.Any(warning => warning.Contains("Kavindi", StringComparison.Ordinal)))
    throw new Exception("The unreadable student ID was not reported.");
if (photoExtract.Rows.Any(row => row.JerseyNo is not null))
    throw new Exception("Photo jersey numbers should be empty.");

Console.WriteLine("team card fixtures passed");

static void CheckOffice(string path, string section, int count, string[] ids)
{
    var extract = TeamCardParser.ExtractOffice(Path.GetFileName(path), File.ReadAllBytes(path));
    Expect(extract, section, count, ids);
    if (extract.Rows.Any(row => row.JerseyNo is not null))
        throw new Exception(Path.GetFileName(path) + " should not have jersey numbers.");
    Console.WriteLine($"{Path.GetFileName(path)} {extract.Rows.Count} ok");
}

static void Expect(TeamCardExtract extract, string? section, int count, string[] ids)
{
    if (extract.Section != section) throw new Exception($"Section was {extract.Section ?? "empty"}, expected {section ?? "empty"}.");
    if (extract.Rows.Count != count) throw new Exception($"Expected {count} rows, got {extract.Rows.Count}.");
    if (!ids.SequenceEqual(extract.Rows.Select(row => row.StudentId)))
        throw new Exception("Student IDs did not match: " + string.Join(",", extract.Rows.Select(row => row.StudentId)));
}
