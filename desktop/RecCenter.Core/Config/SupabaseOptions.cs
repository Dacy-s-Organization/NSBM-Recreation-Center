namespace RecCenter.Core.Config;

/// <summary>Supabase project settings. Only the publishable (anon) key belongs here — never service_role.</summary>
public sealed class SupabaseOptions
{
    public string Url { get; set; } = "";
    public string PublishableKey { get; set; } = "";

    public bool IsConfigured =>
        Uri.TryCreate(Url, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(PublishableKey);
}
