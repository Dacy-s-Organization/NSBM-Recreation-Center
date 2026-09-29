using System.IO;
using System.Text.Json;

namespace RecCenter.Desktop.Services;

/// <summary>Window placement and last theme, persisted to %AppData%\NSBM Recreation Center\window.json.</summary>
public sealed class WindowSettings
{
    public double? Left { get; set; }
    public double? Top { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public bool Maximized { get; set; }
    public bool? IsDark { get; set; }

    private static string FilePath => Path.Combine(AppPaths.RoamingDataDirectory, "window.json");

    public static WindowSettings Load()
    {
        try
        {
            if (File.Exists(FilePath))
                return JsonSerializer.Deserialize<WindowSettings>(File.ReadAllText(FilePath)) ?? new();
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
        }
        return new();
    }

    public void Save()
    {
        try
        {
            File.WriteAllText(FilePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
        }
    }
}
