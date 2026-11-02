using System.Text;
using System.Text.Json;

namespace RecCenter.Core.Supabase;

public sealed class SupabaseSession
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public long ExpiresAt { get; set; }
    public string? UserEmail { get; set; }

    /// <summary>Role claim in the access token. Row Level Security reads the same claim.</summary>
    public string? Role => ReadRole(AccessToken);

    public string? Aal => ReadTopLevelString(AccessToken, "aal");

    public static string? ReadRole(string? accessToken)
    {
        if (string.IsNullOrEmpty(accessToken)) return null;
        var parts = accessToken.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload += (payload.Length % 4) switch
            {
                2 => "==",
                3 => "=",
                _ => "",
            };
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            if (doc.RootElement.TryGetProperty("app_metadata", out var meta) &&
                meta.ValueKind == JsonValueKind.Object &&
                meta.TryGetProperty("role", out var role) &&
                role.ValueKind == JsonValueKind.String)
                return role.GetString();
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return null;
        }
        return null;
    }

    private static string? ReadTopLevelString(string? accessToken, string name)
    {
        if (string.IsNullOrEmpty(accessToken)) return null;
        var parts = accessToken.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload += (payload.Length % 4) switch
            {
                2 => "==",
                3 => "=",
                _ => "",
            };
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            if (doc.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                return value.GetString();
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            return null;
        }
        return null;
    }

    public bool ExpiresSoon =>
        DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= ExpiresAt - 60;
}

public interface ISessionStore
{
    SupabaseSession? Load();
    void Save(SupabaseSession session);
    void Clear();
}
