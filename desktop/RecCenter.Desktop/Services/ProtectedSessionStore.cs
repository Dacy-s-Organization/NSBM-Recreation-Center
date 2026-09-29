using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using RecCenter.Core.Supabase;

namespace RecCenter.Desktop.Services;

/// <summary>Persists the Supabase session in %AppData%, encrypted with Windows DPAPI for the current user.</summary>
public sealed class ProtectedSessionStore : ISessionStore
{
    private static readonly byte[] Entropy = "nsbm-rec-center-session"u8.ToArray();

    private static string FilePath => Path.Combine(AppPaths.RoamingDataDirectory, "session.dat");

    public SupabaseSession? Load()
    {
        try
        {
            if (!File.Exists(FilePath)) return null;
            var plain = ProtectedData.Unprotect(File.ReadAllBytes(FilePath), Entropy, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<SupabaseSession>(plain);
        }
        catch (Exception ex) when (ex is CryptographicException or JsonException or IOException)
        {
            Clear();
            return null;
        }
    }

    public void Save(SupabaseSession session)
    {
        var plain = JsonSerializer.SerializeToUtf8Bytes(session);
        File.WriteAllBytes(FilePath, ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser));
    }

    public void Clear()
    {
        try
        {
            if (File.Exists(FilePath)) File.Delete(FilePath);
        }
        catch (IOException)
        {
            /* best effort */
        }
    }
}
