using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

public sealed class TeamCardOption
{
    public string Id { get; set; } = "";
    public string EventName { get; set; } = "";
}

public sealed class TeamCardRecord
{
    public string Id { get; set; } = "";
    public string Section { get; set; } = "";
    public string EventName { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public List<TeamCardMemberRecord> TeamCardMembers { get; set; } = new();
    public List<TeamCardPhotoRecord> TeamCardPhotos { get; set; } = new();
}

public sealed class TeamCardMemberRecord
{
    public string Id { get; set; } = "";
    public int Position { get; set; }
    public string StudentId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string? JerseyNo { get; set; }
}

public sealed class TeamCardPhotoRecord
{
    public string Id { get; set; } = "";
    public string FileName { get; set; } = "";
}

public sealed class TeamCardsService
{
    private readonly PostgrestClient _db;

    public TeamCardsService(PostgrestClient db) => _db = db;

    public async Task<List<TeamCardOption>> ListOptionsAsync(string section) =>
        await _db.GetAsync<TeamCardOption>(PostgrestClient.From("team_cards").Select("id, event_name").Eq("section", section).Order("event_name"));

    public async Task<List<TeamCardRecord>> GetAllAsync()
    {
        var cards = await _db.GetAsync<TeamCardRecord>(PostgrestClient.From("team_cards")
            .Select("id, section, event_name, created_at, team_card_members(id, position, student_id, full_name, jersey_no), team_card_photos(id, file_name)")
            .Order("created_at", false));
        foreach (var card in cards)
            card.TeamCardMembers = card.TeamCardMembers.OrderBy(member => member.Position).ToList();
        return cards;
    }

    public async Task<Dictionary<string, int>> LinkCountsAsync()
    {
        var fiesta = _db.GetAsync<LinkRow>(PostgrestClient.From("sports_achievements").Select("team_card_id").NotNull("team_card_id"));
        var inter = _db.GetAsync<LinkRow>(PostgrestClient.From("inter_uni_achievements").Select("team_card_id").NotNull("team_card_id"));
        await Task.WhenAll(fiesta, inter);
        var counts = new Dictionary<string, int>();
        foreach (var row in fiesta.Result.Concat(inter.Result))
        {
            if (string.IsNullOrWhiteSpace(row.TeamCardId)) continue;
            counts[row.TeamCardId] = counts.GetValueOrDefault(row.TeamCardId) + 1;
        }
        return counts;
    }

    public async Task<(string? Id, string? Error)> AddAsync(string section, string eventName, string sourceKind, string? fileName, IReadOnlyList<TeamCardMemberInput> members)
    {
        var parsed = Validate(eventName, members);
        if (parsed.Error is not null) return (null, parsed.Error);
        if (section is not ("sports-fiesta" or "inter-university")) return (null, "Choose Sports Fiesta or Inter University.");
        if (sourceKind is not ("docx" or "xlsx" or "csv" or "image")) return (null, "The team card file could not be read.");

        List<IdRow> created;
        try
        {
            created = await _db.InsertAsync<IdRow>("team_cards", new CardInsert(section, eventName.Trim(), sourceKind, string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim()), "id");
        }
        catch (PostgrestException ex)
        {
            return (null, ex.Message);
        }
        var id = created.FirstOrDefault()?.Id;
        if (string.IsNullOrWhiteSpace(id)) return (null, "The team card could not be saved.");

        try
        {
            await _db.InsertAsync("team_card_members", parsed.Members!.Select((member, index) => new MemberInsert(id, index, member.StudentId, member.FullName, member.JerseyNo)).ToList());
            return (id, null);
        }
        catch (PostgrestException ex)
        {
            try { await _db.DeleteAsync(PostgrestClient.From("team_cards").Eq("id", id)); } catch { /* the card is removed when the database allows it */ }
            return (null, ex.Message);
        }
    }

    public async Task<ActionResult> UpdateAsync(string id, string eventName, IReadOnlyList<TeamCardMemberInput> members)
    {
        var parsed = Validate(eventName, members);
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Team card was not found.");
        if (parsed.Error is not null) return ActionResult.Fail(parsed.Error);
        try
        {
            await _db.RpcAsync("replace_team_card_members", new ReplaceArgs(id, eventName.Trim(), parsed.Members!));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }

    public async Task<ActionResult> DeleteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Team card was not found.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("team_cards").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }

    public async Task<ActionResult> AddPhotoAsync(string cardId, string fileName, string contentType, byte[] bytes)
    {
        if (string.IsNullOrWhiteSpace(cardId)) return ActionResult.Fail("Team card was not found.");
        if (bytes.Length == 0 || bytes.Length > 4 * 1024 * 1024) return ActionResult.Fail("Each photo must be 4 MB or smaller.");
        try
        {
            await _db.RpcAsync("add_team_card_photo", new PhotoArgs(cardId, fileName, contentType, Convert.ToBase64String(bytes)));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message.Contains("at most 10", StringComparison.OrdinalIgnoreCase)
                ? "A team card can have at most 10 photos."
                : ex.Message);
        }
    }

    public async Task<ActionResult> DeletePhotoAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return ActionResult.Fail("Photo was not found.");
        try
        {
            await _db.DeleteAsync(PostgrestClient.From("team_card_photos").Eq("id", id));
            return ActionResult.Ok;
        }
        catch (PostgrestException ex)
        {
            return ActionResult.Fail(ex.Message);
        }
    }

    public async Task<(byte[]? Bytes, string? ContentType, string? Error)> GetPhotoAsync(string id)
    {
        try
        {
            var rows = await _db.RpcAsync<List<PhotoRow>>("get_team_card_photo", new PhotoIdArgs(id));
            var row = rows?.FirstOrDefault();
            if (row is null || string.IsNullOrWhiteSpace(row.ImageBase64)) return (null, null, "Photo was not found.");
            return (Convert.FromBase64String(row.ImageBase64), row.ContentType, null);
        }
        catch (PostgrestException ex)
        {
            return (null, null, ex.Message);
        }
    }

    private static (List<MemberPayload>? Members, string? Error) Validate(string eventName, IReadOnlyList<TeamCardMemberInput> members)
    {
        if (string.IsNullOrWhiteSpace(eventName)) return (null, "Event name is required.");
        if (members.Count == 0) return (null, "Add at least one athlete.");
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var rows = new List<MemberPayload>();
        foreach (var member in members)
        {
            var studentId = member.StudentId.Trim();
            var name = string.Join(" ", member.FullName.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            var jersey = string.IsNullOrWhiteSpace(member.JerseyNo) ? null : member.JerseyNo.Trim();
            if (studentId.Length == 0 || name.Length == 0) return (null, "Every row needs a student ID and a name.");
            if (!seen.Add(studentId)) return (null, $"Student ID {studentId} is listed more than once.");
            rows.Add(new MemberPayload(studentId, name, jersey));
        }
        return (rows, null);
    }

    public sealed record TeamCardMemberInput(string StudentId, string FullName, string? JerseyNo);

    public sealed class TeamCardDraftRow
    {
        public string StudentId { get; set; } = "";
        public string FullName { get; set; } = "";
        public string JerseyNo { get; set; } = "";
    }
    private sealed record CardInsert(string Section, string EventName, string SourceKind, string? SourceFileName);
    private sealed record MemberInsert(string TeamCardId, int Position, string StudentId, string FullName, string? JerseyNo);
    private sealed record MemberPayload(string StudentId, string FullName, string? JerseyNo);
    private sealed record ReplaceArgs(string PCard, string PEventName, List<MemberPayload> PMembers);
    private sealed record PhotoArgs(string PCard, string PFileName, string PContentType, string PImageBase64);
    private sealed record PhotoIdArgs(string PId);
    private sealed record PhotoRow(string FileName, string ContentType, string ImageBase64);
    private sealed record LinkRow(string? TeamCardId);
    private sealed record IdRow(string Id);
}
