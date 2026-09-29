namespace RecCenter.Core.Supabase;

public sealed class SupabaseSession
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public long ExpiresAt { get; set; }
    public string? UserEmail { get; set; }

    public bool ExpiresSoon =>
        DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= ExpiresAt - 60;
}

public interface ISessionStore
{
    SupabaseSession? Load();
    void Save(SupabaseSession session);
    void Clear();
}
