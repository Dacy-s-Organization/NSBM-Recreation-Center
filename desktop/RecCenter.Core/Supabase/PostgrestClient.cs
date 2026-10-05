using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using RecCenter.Core.Config;

namespace RecCenter.Core.Supabase;

public sealed class PostgrestException : Exception
{
    public PostgrestException(string message, string? code) : base(message) => Code = code;
    public string? Code { get; }
}

/// <summary>Fluent PostgREST query: table, select, filters, ordering and paging.</summary>
public sealed class PgQuery
{
    private readonly List<string> _params = new();

    public PgQuery(string table) => Table = table;

    public string Table { get; }
    public string? SelectColumns { get; private set; }

    public PgQuery Select(string columns)
    {
        SelectColumns = StripWhitespace(columns);
        return this;
    }

    public PgQuery Eq(string column, object value)
    {
        _params.Add($"{column}=eq.{Uri.EscapeDataString(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "")}");
        return this;
    }

    public PgQuery IsNull(string column)
    {
        _params.Add($"{column}=is.null");
        return this;
    }

    public PgQuery NotNull(string column)
    {
        _params.Add($"{column}=not.is.null");
        return this;
    }

    public PgQuery In(string column, IEnumerable<string> values)
    {
        var list = string.Join(",", values.Select(v => $"\"{v.Replace("\\", "\\\\").Replace("\"", "\\\"")}\""));
        _params.Add($"{column}=in.({Uri.EscapeDataString(list)})");
        return this;
    }

    /// <summary>Adds <c>or=(filter)</c>. The caller must strip PostgREST syntax characters from user input.</summary>
    public PgQuery Or(string filter)
    {
        _params.Add($"or=({Uri.EscapeDataString(filter)})");
        return this;
    }

    private readonly List<string> _order = new();

    public PgQuery Order(string column, bool ascending = true)
    {
        _order.Add($"{column}.{(ascending ? "asc" : "desc")}");
        return this;
    }

    private int? _offset;
    private int? _limit;

    public PgQuery Range(int from, int to)
    {
        _offset = from;
        _limit = to - from + 1;
        return this;
    }

    public PgQuery Limit(int limit)
    {
        _limit = limit;
        return this;
    }

    internal string BuildQueryString(bool includeSelect = true, IEnumerable<string>? extra = null)
    {
        var parts = new List<string>();
        if (includeSelect && SelectColumns is not null) parts.Add($"select={Uri.EscapeDataString(SelectColumns)}");
        parts.AddRange(_params);
        if (_order.Count > 0) parts.Add($"order={string.Join(",", _order)}");
        if (_offset is not null) parts.Add($"offset={_offset}");
        if (_limit is not null) parts.Add($"limit={_limit}");
        if (extra is not null) parts.AddRange(extra);
        return parts.Count == 0 ? "" : "?" + string.Join("&", parts);
    }

    private static string StripWhitespace(string columns)
    {
        var sb = new StringBuilder(columns.Length);
        var quoted = false;
        foreach (var c in columns)
        {
            if (c == '"') quoted = !quoted;
            if (!quoted && char.IsWhiteSpace(c)) continue;
            sb.Append(c);
        }
        return sb.ToString();
    }
}

/// <summary>Minimal PostgREST client that authenticates with the signed-in user's JWT (RLS applies).</summary>
public sealed class PostgrestClient
{
    public const int PageSize = 1000;

    private readonly HttpClient _http;
    private readonly SupabaseOptions _options;
    private readonly AuthService _auth;

    public PostgrestClient(HttpClient http, SupabaseOptions options, AuthService auth)
    {
        _http = http;
        _options = options;
        _auth = auth;
    }

    public static PgQuery From(string table) => new(table);

    public async Task<List<T>> GetAsync<T>(PgQuery query)
    {
        var body = await SendAsync(HttpMethod.Get, query.Table + query.BuildQueryString(), null, null);
        return JsonSerializer.Deserialize<List<T>>(body, Json.Options) ?? new List<T>();
    }

    public async Task<T?> MaybeSingleAsync<T>(PgQuery query) where T : class
    {
        var rows = await GetAsync<T>(query.Limit(2));
        return rows.Count == 1 ? rows[0] : null;
    }

    /// <summary>Loads every row by paging past PostgREST's 1000-row cap (mirrors lib/supabase/fetch-all).</summary>
    public async Task<List<T>> GetAllPagesAsync<T>(Func<PgQuery> buildQuery)
    {
        var all = new List<T>();
        for (var from = 0; ; from += PageSize)
        {
            var page = await GetAsync<T>(buildQuery().Range(from, from + PageSize - 1));
            all.AddRange(page);
            if (page.Count < PageSize) break;
        }
        return all;
    }

    /// <summary>Exact row count (HEAD with Prefer: count=exact).</summary>
    public async Task<int> CountAsync(PgQuery query)
    {
        var token = await RequireTokenAsync();
        using var request = BuildRequest(HttpMethod.Head, query.Table + query.BuildQueryString(), token, null, "count=exact");
        using var response = await _http.SendAsync(request);
        if (!response.IsSuccessStatusCode) return 0;

        var range = response.Content.Headers.TryGetValues("Content-Range", out var values)
            ? values.FirstOrDefault()
            : response.Headers.TryGetValues("Content-Range", out var hv) ? hv.FirstOrDefault() : null;
        if (range is null) return 0;
        var slash = range.LastIndexOf('/');
        return slash >= 0 && int.TryParse(range[(slash + 1)..], out var n) ? n : 0;
    }

    public Task<string> RpcAsync(string function, object args) =>
        SendAsync(HttpMethod.Post, "rpc/" + function, args, null);

    public async Task<T?> RpcAsync<T>(string function, object args)
    {
        var json = await RpcAsync(function, args);
        if (string.IsNullOrWhiteSpace(json) || json is "[]" or "null") return default;
        return JsonSerializer.Deserialize<T>(json, Json.Options);
    }

    public async Task InsertAsync(string table, object body)
    {
        await SendAsync(HttpMethod.Post, table, body, "return=minimal");
    }

    public async Task<List<T>> InsertAsync<T>(string table, object body, string select)
    {
        var json = await SendAsync(HttpMethod.Post, table + new PgQuery(table).Select(select).BuildQueryString(), body, "return=representation");
        return JsonSerializer.Deserialize<List<T>>(json, Json.Options) ?? new List<T>();
    }

    public async Task<List<T>> UpsertAsync<T>(string table, object body, string onConflict, string select)
    {
        var path = table + new PgQuery(table).Select(select).BuildQueryString(extra: new[] { $"on_conflict={onConflict}" });
        var json = await SendAsync(HttpMethod.Post, path, body, "resolution=merge-duplicates,return=representation");
        return JsonSerializer.Deserialize<List<T>>(json, Json.Options) ?? new List<T>();
    }

    public async Task UpdateAsync(PgQuery filter, object body)
    {
        await SendAsync(HttpMethod.Patch, filter.Table + filter.BuildQueryString(includeSelect: false), body, "return=minimal");
    }

    public async Task<List<T>> UpdateAsync<T>(PgQuery filter, object body, string select)
    {
        var path = filter.Table + filter.Select(select).BuildQueryString();
        var json = await SendAsync(HttpMethod.Patch, path, body, "return=representation");
        return JsonSerializer.Deserialize<List<T>>(json, Json.Options) ?? new List<T>();
    }

    public async Task DeleteAsync(PgQuery filter)
    {
        await SendAsync(HttpMethod.Delete, filter.Table + filter.BuildQueryString(includeSelect: false), null, "return=minimal");
    }

    public async Task<List<T>> DeleteAsync<T>(PgQuery filter, string select)
    {
        var path = filter.Table + filter.Select(select).BuildQueryString();
        var json = await SendAsync(HttpMethod.Delete, path, null, "return=representation");
        return JsonSerializer.Deserialize<List<T>>(json, Json.Options) ?? new List<T>();
    }

    private async Task<string> RequireTokenAsync(bool forceRefresh = false)
    {
        return await _auth.GetAccessTokenAsync(forceRefresh)
            ?? throw new PostgrestException("Not signed in.", null);
    }

    private async Task<string> SendAsync(HttpMethod method, string pathAndQuery, object? body, string? prefer)
    {
        var token = await RequireTokenAsync();
        for (var attempt = 0; ; attempt++)
        {
            using var request = BuildRequest(method, pathAndQuery, token, body, prefer);
            HttpResponseMessage response;
            try
            {
                response = await _http.SendAsync(request);
            }
            catch (HttpRequestException ex)
            {
                throw new PostgrestException(ex.Message, null);
            }

            using (response)
            {
                var text = await response.Content.ReadAsStringAsync();
                if (response.IsSuccessStatusCode) return string.IsNullOrEmpty(text) ? "[]" : text;

                if (response.StatusCode == HttpStatusCode.Unauthorized && attempt == 0)
                {
                    token = await RequireTokenAsync(forceRefresh: true);
                    continue;
                }

                throw ParseError(text, response.StatusCode);
            }
        }
    }

    private HttpRequestMessage BuildRequest(HttpMethod method, string pathAndQuery, string token, object? body, string? prefer)
    {
        var request = new HttpRequestMessage(method, $"{_options.Url.TrimEnd('/')}/rest/v1/{pathAndQuery}");
        request.Headers.Add("apikey", _options.PublishableKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (prefer is not null) request.Headers.Add("Prefer", prefer);
        if (body is not null)
        {
            request.Content = new StringContent(
                JsonSerializer.Serialize(body, body.GetType(), Json.Options),
                Encoding.UTF8,
                "application/json");
        }
        return request;
    }

    private static PostgrestException ParseError(string text, HttpStatusCode status)
    {
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            var message = root.TryGetProperty("message", out var m) ? m.GetString() : null;
            var code = root.TryGetProperty("code", out var c) ? c.ToString() : null;
            return new PostgrestException(message ?? $"Request failed ({(int)status}).", code);
        }
        catch (JsonException)
        {
            return new PostgrestException(string.IsNullOrWhiteSpace(text) ? $"Request failed ({(int)status})." : text, null);
        }
    }
}
