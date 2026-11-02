using System.IO;
using System.Text.Json;
using RecCenter.Core.Config;

namespace RecCenter.Desktop.Services;

/// <summary>
/// Reads the Supabase settings embedded at build time.
/// A file next to the exe is used only in Debug builds.
/// </summary>
public static class ConfigLoader
{
    private const string FileName = "appsettings.json";

    public static SupabaseOptions LoadSupabaseOptions()
    {
#if DEBUG
        var external = Path.Combine(AppContext.BaseDirectory, FileName);
        if (File.Exists(external))
        {
            var fromFile = Parse(File.ReadAllText(external));
            if (fromFile.IsConfigured) return fromFile;
        }
#endif

        using var stream = typeof(ConfigLoader).Assembly.GetManifestResourceStream(FileName);
        if (stream is null) return new SupabaseOptions();
        using var reader = new StreamReader(stream);
        return Parse(reader.ReadToEnd());
    }

    private static SupabaseOptions Parse(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json, new JsonDocumentOptions { CommentHandling = JsonCommentHandling.Skip });
            if (!doc.RootElement.TryGetProperty("Supabase", out var section)) return new SupabaseOptions();
            return new SupabaseOptions
            {
                Url = section.TryGetProperty("Url", out var url) ? url.GetString() ?? "" : "",
                PublishableKey = section.TryGetProperty("PublishableKey", out var key) ? key.GetString() ?? "" : "",
            };
        }
        catch (JsonException)
        {
            return new SupabaseOptions();
        }
    }
}
