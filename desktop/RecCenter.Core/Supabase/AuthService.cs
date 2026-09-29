using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using RecCenter.Core.Config;

namespace RecCenter.Core.Supabase;

/// <summary>GoTrue email/password auth with persisted, auto-refreshed sessions.</summary>
public sealed class AuthService
{
    private readonly HttpClient _http;
    private readonly SupabaseOptions _options;
    private readonly ISessionStore _store;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private SupabaseSession? _session;

    public AuthService(HttpClient http, SupabaseOptions options, ISessionStore store)
    {
        _http = http;
        _options = options;
        _store = store;
    }

    public event Action? SessionChanged;

    public bool IsSignedIn => _session is not null;
    public string? UserEmail => _session?.UserEmail;

    /// <summary>Restores the saved session, refreshing it when the access token has expired.</summary>
    public async Task<bool> TryRestoreAsync()
    {
        var saved = _store.Load();
        if (saved is null || string.IsNullOrEmpty(saved.RefreshToken)) return false;

        _session = saved;
        if (!saved.ExpiresSoon) return true;

        return await RefreshAsync(saved.RefreshToken);
    }

    /// <returns>An error message, or null on success.</returns>
    public async Task<string?> SignInWithPasswordAsync(string email, string password)
    {
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_options.Url.TrimEnd('/')}/auth/v1/token?grant_type=password")
            {
                Content = JsonContent.Create(new { email, password }),
            };
            request.Headers.Add("apikey", _options.PublishableKey);

            using var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode) return ReadAuthError(body);

            SetSession(ParseSession(body));
            return null;
        }
        catch (HttpRequestException ex)
        {
            return ex.Message;
        }
    }

    public async Task SignOutAsync()
    {
        var session = _session;
        _session = null;
        _store.Clear();
        SessionChanged?.Invoke();

        if (session is null) return;
        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"{_options.Url.TrimEnd('/')}/auth/v1/logout");
            request.Headers.Add("apikey", _options.PublishableKey);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
            using var _ = await _http.SendAsync(request);
        }
        catch
        {
            /* the local session is already gone */
        }
    }

    /// <summary>Returns a valid access token, refreshing first if needed. Null when signed out.</summary>
    public async Task<string?> GetAccessTokenAsync(bool forceRefresh = false)
    {
        var session = _session;
        if (session is null) return null;
        if (!forceRefresh && !session.ExpiresSoon) return session.AccessToken;

        await RefreshAsync(session.RefreshToken);
        return _session?.AccessToken;
    }

    private async Task<bool> RefreshAsync(string refreshToken)
    {
        await _refreshLock.WaitAsync();
        try
        {
            if (_session is not null && _session.RefreshToken != refreshToken && !_session.ExpiresSoon)
                return true;

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_options.Url.TrimEnd('/')}/auth/v1/token?grant_type=refresh_token")
            {
                Content = JsonContent.Create(new { refresh_token = refreshToken }),
            };
            request.Headers.Add("apikey", _options.PublishableKey);

            using var response = await _http.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                if ((int)response.StatusCode is >= 400 and < 500)
                {
                    _session = null;
                    _store.Clear();
                    SessionChanged?.Invoke();
                }
                return false;
            }

            SetSession(ParseSession(body));
            return true;
        }
        catch (HttpRequestException)
        {
            return _session is not null;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private void SetSession(SupabaseSession session)
    {
        _session = session;
        _store.Save(session);
        SessionChanged?.Invoke();
    }

    private static SupabaseSession ParseSession(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var expiresAt = root.TryGetProperty("expires_at", out var ea) && ea.ValueKind == JsonValueKind.Number
            ? ea.GetInt64()
            : DateTimeOffset.UtcNow.ToUnixTimeSeconds() + root.GetProperty("expires_in").GetInt64();

        string? email = null;
        if (root.TryGetProperty("user", out var user) && user.TryGetProperty("email", out var em))
            email = em.GetString();

        return new SupabaseSession
        {
            AccessToken = root.GetProperty("access_token").GetString() ?? "",
            RefreshToken = root.GetProperty("refresh_token").GetString() ?? "",
            ExpiresAt = expiresAt,
            UserEmail = email,
        };
    }

    private static string ReadAuthError(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            foreach (var key in new[] { "msg", "error_description", "message", "error" })
            {
                if (root.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String)
                {
                    var text = v.GetString();
                    if (!string.IsNullOrWhiteSpace(text)) return text;
                }
            }
        }
        catch (JsonException)
        {
            /* fall through */
        }
        return "Sign in failed.";
    }
}
