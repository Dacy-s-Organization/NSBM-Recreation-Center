using RecCenter.Core.Domain;
using RecCenter.Core.Models;
using RecCenter.Core.Supabase;

namespace RecCenter.Core.Services;

internal sealed class StudentExisting
{
    public string Id { get; set; } = "";
    public string? StudentId { get; set; }
    public int? SerialNo { get; set; }
    public string? HouseId { get; set; }
    public string? Faculty { get; set; }
    public string? Intake { get; set; }
}

internal sealed class StudentIdRow
{
    public string Id { get; set; } = "";
    public string? StudentId { get; set; }
}

internal sealed class NamedRow
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
}

internal sealed class RecordKeyRow
{
    public string Id { get; set; } = "";
    public string StudentId { get; set; } = "";
    public string TrackId { get; set; } = "";
    public int Year { get; set; }
}

internal sealed record RecordValuePayload(double Value);

internal sealed record InventoryQuantityPayload(int Quantity, string UpdatedAt);

/// <summary>Bulk CSV imports (port of app/actions/import.ts).</summary>
public sealed class ImportService
{
    public const int ImportBatchSize = 100;
    private const int UpdateConcurrency = 20;
    private const string StudentExistingSelect = "id, student_id, serial_no, house_id, faculty, intake";

    private readonly PostgrestClient _db;
    private readonly AuthService _auth;
    private readonly AchievementsService _achievements;

    public ImportService(PostgrestClient db, AuthService auth, AchievementsService achievements)
    {
        _db = db;
        _auth = auth;
        _achievements = achievements;
    }

    public Task<ImportResult> ImportAsync(ImportType type, IReadOnlyList<ImportPreviewRow> validRows) => type switch
    {
        ImportType.Students => ImportStudentsAsync(validRows),
        ImportType.Records => ImportRecordsAsync(validRows),
        ImportType.Inventory => ImportInventoryAsync(validRows),
        _ => ImportAchievementsAsync(validRows),
    };

    private ImportResult? NotSignedIn()
    {
        if (_auth.IsSignedIn) return null;
        var r = new ImportResult();
        r.Errors.Add("Not signed in.");
        return r;
    }

    private static IEnumerable<List<T>> Chunk<T>(IReadOnlyList<T> items, int size)
    {
        for (var i = 0; i < items.Count; i += size)
            yield return items.Skip(i).Take(size).ToList();
    }

    private static string? SerialContextKey(string? faculty, string? intake, int? serialNo)
    {
        if (serialNo is null || string.IsNullOrEmpty(faculty) || string.IsNullOrEmpty(intake)) return null;
        return $"{faculty}|{intake}|{serialNo}";
    }

    private static StudentPayload StudentInsertPayload(ImportPreviewRow row, string? houseId)
    {
        var serialRaw = row.Get("serial_no").Trim();
        var serialNo = serialRaw.Length > 0 ? Formatting.ParseIntLoose(serialRaw) : null;
        return new StudentPayload(
            FormText.NullIfEmpty(row.Get("student_id")),
            row.Get("full_name").Trim(),
            houseId,
            serialNo,
            FormText.NullIfEmpty(Faculties.NormalizeCode(row.Get("faculty"))),
            FormText.NullIfEmpty(row.Get("intake")),
            FormText.NullIfEmpty(row.Get("degree_programme")),
            FormText.NullIfEmpty(row.Get("university")),
            FormText.NullIfEmpty(row.Get("title")),
            FormText.NullIfEmpty(row.Get("gender")),
            FormText.NullIfEmpty(row.Get("nic")),
            FormText.NullIfEmpty(row.Get("mobile")),
            FormText.NullIfEmpty(row.Get("email")));
    }

    private async Task RunUpdatesAsync(ImportResult result, IReadOnlyList<Func<Task>> updates)
    {
        foreach (var batch in Chunk(updates, UpdateConcurrency))
        {
            var outcomes = await Task.WhenAll(batch.Select(async update =>
            {
                try
                {
                    await update();
                    return (string?)null;
                }
                catch (PostgrestException ex)
                {
                    return ex.Message;
                }
            }));
            foreach (var error in outcomes)
            {
                if (error is not null)
                {
                    result.Errors.Add($"Update: {error}");
                }
                else
                {
                    result.Success++;
                    result.Updated++;
                }
            }
        }
    }

    public async Task<ImportResult> ImportStudentsAsync(IReadOnlyList<ImportPreviewRow> rows)
    {
        if (NotSignedIn() is { } denied) return denied;
        var result = new ImportResult();

        List<House> houses;
        List<StudentExisting> existingRows;
        try
        {
            houses = await _db.GetAsync<House>(PostgrestClient.From("houses").Select("id, name"));
        }
        catch (PostgrestException)
        {
            houses = new List<House>();
        }
        var houseMap = Houses.BuildIdMap(houses);

        try
        {
            existingRows = await _db.GetAllPagesAsync<StudentExisting>(() =>
                PostgrestClient.From("students").Select(StudentExistingSelect));
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load existing students: {ex.Message}");
            return result;
        }

        var byStudentId = new Dictionary<string, StudentExisting>();
        var bySerialContext = new Dictionary<string, StudentExisting>();
        foreach (var row in existingRows)
        {
            if (!string.IsNullOrEmpty(row.StudentId)) byStudentId[row.StudentId] = row;
            var key = SerialContextKey(row.Faculty, row.Intake, row.SerialNo);
            if (key is not null) bySerialContext[key] = row;
        }

        var withId = new List<StudentPayload>();
        var withoutId = new List<StudentPayload>();

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var line = i + 2;
            var houseName = row.Get("house_name").Trim();
            var houseId = houseName.Length > 0 ? Houses.LookupId(houseName, houseMap) : null;

            if (row.Get("full_name").Trim().Length == 0)
            {
                result.Errors.Add($"Row {line}: missing name or Student ID");
                continue;
            }
            if (houseName.Length > 0 && houseId is null)
            {
                result.Errors.Add($"Row {line}: unknown house \"{row.Get("house_name")}\"");
                continue;
            }

            var payload = StudentInsertPayload(row, houseId);
            StudentExisting? existing = null;
            if (payload.StudentId is not null) byStudentId.TryGetValue(payload.StudentId, out existing);
            if (existing is null)
            {
                var contextKey = SerialContextKey(payload.Faculty, payload.Intake, payload.SerialNo);
                if (contextKey is not null) bySerialContext.TryGetValue(contextKey, out existing);
            }

            if (payload.HouseId is null && existing?.HouseId is not null)
                payload = payload with { HouseId = existing.HouseId };

            if (payload.StudentId is not null) withId.Add(payload);
            else withoutId.Add(payload);
        }

        // Last row wins when the same student_id appears twice in one CSV
        var deduped = new Dictionary<string, StudentPayload>();
        var order = new List<string>();
        foreach (var p in withId)
        {
            if (!deduped.ContainsKey(p.StudentId!)) order.Add(p.StudentId!);
            deduped[p.StudentId!] = p;
        }
        var dedupedWithId = order.Select(id => deduped[id]).ToList();
        if (dedupedWithId.Count < withId.Count) result.Skipped += withId.Count - dedupedWithId.Count;

        foreach (var batch in Chunk(dedupedWithId, ImportBatchSize))
        {
            var batchUpdated = batch.Count(p => byStudentId.ContainsKey(p.StudentId!));
            var batchInserted = batch.Count - batchUpdated;
            try
            {
                var upserted = await _db.UpsertAsync<StudentExisting>("students", batch, "student_id", StudentExistingSelect);
                result.Success += batch.Count;
                result.Inserted += batchInserted;
                result.Updated += batchUpdated;
                foreach (var row in upserted)
                {
                    if (!string.IsNullOrEmpty(row.StudentId)) byStudentId[row.StudentId] = row;
                    var key = SerialContextKey(row.Faculty, row.Intake, row.SerialNo);
                    if (key is not null) bySerialContext[key] = row;
                }
            }
            catch (PostgrestException ex)
            {
                result.Errors.Add($"Batch upsert: {ex.Message}");
            }
        }

        var toInsertNoId = new List<StudentPayload>();
        var toUpdateNoId = new List<(string Id, StudentPayload Payload)>();
        foreach (var payload in withoutId)
        {
            var key = SerialContextKey(payload.Faculty, payload.Intake, payload.SerialNo);
            if (key is not null && bySerialContext.TryGetValue(key, out var existing) && !string.IsNullOrEmpty(existing.Id))
                toUpdateNoId.Add((existing.Id, payload));
            else
                toInsertNoId.Add(payload);
        }

        foreach (var batch in Chunk(toInsertNoId, ImportBatchSize))
        {
            try
            {
                await _db.InsertAsync("students", batch);
                result.Success += batch.Count;
                result.Inserted += batch.Count;
            }
            catch (PostgrestException ex)
            {
                result.Errors.Add($"Batch insert: {ex.Message}");
            }
        }

        await RunUpdatesAsync(result, toUpdateNoId
            .Select(u => (Func<Task>)(() => _db.UpdateAsync(PostgrestClient.From("students").Eq("id", u.Id), u.Payload)))
            .ToList());

        return result;
    }

    public async Task<ImportResult> ImportRecordsAsync(IReadOnlyList<ImportPreviewRow> rows)
    {
        if (NotSignedIn() is { } denied) return denied;
        var result = new ImportResult();

        List<StudentIdRow> students;
        List<NamedRow> tracks;
        var studentsTask = _db.GetAllPagesAsync<StudentIdRow>(() => PostgrestClient.From("students").Select("id, student_id"));
        var tracksTask = _db.GetAllPagesAsync<NamedRow>(() => PostgrestClient.From("sport_tracks").Select("id, name"));
        try
        {
            students = await studentsTask;
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load students: {ex.Message}");
            return result;
        }
        try
        {
            tracks = await tracksTask;
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load tracks: {ex.Message}");
            return result;
        }

        var studentMap = new Dictionary<string, string>();
        foreach (var s in students.Where(s => !string.IsNullOrEmpty(s.StudentId))) studentMap[s.StudentId!] = s.Id;
        var trackMap = new Dictionary<string, string>();
        foreach (var t in tracks) trackMap[t.Name.ToLowerInvariant()] = t.Id;

        List<RecordKeyRow> existingRecords;
        try
        {
            existingRecords = await _db.GetAllPagesAsync<RecordKeyRow>(() =>
                PostgrestClient.From("sport_records").Select("id, student_id, track_id, year"));
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load records: {ex.Message}");
            return result;
        }

        static string RecordKey(string studentId, string trackId, int year) => $"{studentId}:{trackId}:{year}";
        var existingRecordMap = new Dictionary<string, string>();
        foreach (var r in existingRecords) existingRecordMap[RecordKey(r.StudentId, r.TrackId, r.Year)] = r.Id;

        var toInsert = new List<RecordPayload>();
        var toUpdate = new List<(string Id, double Value)>();

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var line = i + 2;
            studentMap.TryGetValue(row.Get("student_id").Trim(), out var studentUuid);
            trackMap.TryGetValue(row.Get("track_name").Trim().ToLowerInvariant(), out var trackId);
            var value = Formatting.ParseFloatLoose(row.Get("value"));
            var year = Formatting.ParseIntLoose(row.Get("year"));

            if (studentUuid is null)
            {
                result.Errors.Add($"Row {line}: student \"{row.Get("student_id")}\" not found");
                continue;
            }
            if (trackId is null)
            {
                result.Errors.Add($"Row {line}: unknown track \"{row.Get("track_name")}\"");
                continue;
            }
            if (value is null || value < 0)
            {
                result.Errors.Add($"Row {line}: invalid value");
                continue;
            }
            if (year is null || year < 1900 || year > 2100)
            {
                result.Errors.Add($"Row {line}: invalid year");
                continue;
            }

            var key = RecordKey(studentUuid, trackId, year.Value);
            existingRecordMap.TryGetValue(key, out var existingId);
            if (existingId is not null && !existingId.StartsWith("pending:", StringComparison.Ordinal))
            {
                var idx = toUpdate.FindIndex(u => u.Id == existingId);
                if (idx >= 0) toUpdate[idx] = (existingId, value.Value);
                else toUpdate.Add((existingId, value.Value));
            }
            else if (existingId is not null)
            {
                var idx = toInsert.FindIndex(item => RecordKey(item.StudentId, item.TrackId, item.Year) == key);
                if (idx >= 0) toInsert[idx] = new RecordPayload(studentUuid, trackId, year.Value, value.Value);
                result.Skipped++;
            }
            else
            {
                toInsert.Add(new RecordPayload(studentUuid, trackId, year.Value, value.Value));
                existingRecordMap[key] = $"pending:{key}";
            }
        }

        foreach (var batch in Chunk(toInsert, ImportBatchSize))
        {
            try
            {
                await _db.InsertAsync("sport_records", batch);
                result.Success += batch.Count;
                result.Inserted += batch.Count;
            }
            catch (PostgrestException ex)
            {
                result.Errors.Add($"Batch insert: {ex.Message}");
            }
        }

        await RunUpdatesAsync(result, toUpdate
            .Select(u => (Func<Task>)(() => _db.UpdateAsync(PostgrestClient.From("sport_records").Eq("id", u.Id), new RecordValuePayload(u.Value))))
            .ToList());

        return result;
    }

    public async Task<ImportResult> ImportAchievementsAsync(IReadOnlyList<ImportPreviewRow> rows)
    {
        if (NotSignedIn() is { } denied) return denied;
        var result = new ImportResult();

        List<StudentIdRow> students;
        try
        {
            students = await _db.GetAllPagesAsync<StudentIdRow>(() => PostgrestClient.From("students").Select("id, student_id"));
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load students: {ex.Message}");
            return result;
        }

        var studentMap = new Dictionary<string, string>();
        foreach (var s in students.Where(s => !string.IsNullOrEmpty(s.StudentId))) studentMap[s.StudentId!] = s.Id;

        var prepared = new List<(AchievementPayload Achievement, string? WinnerUuid)>();

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var line = i + 2;
            var meetYear = Formatting.ParseIntLoose(row.Get("meet_year"));
            var sport = row.Get("sport").Trim();
            var achievementType = AchievementTypes.Parse(row.Get("achievement_type"));
            var teamNameRaw = row.Get("team_name").Trim();
            var teamName = Houses.ResolveName(teamNameRaw);
            var notes = FormText.NullIfEmpty(row.Get("notes"));
            var winnerStudentId = row.Get("winner_student_id").Trim();

            if (meetYear is null || sport.Length == 0 || achievementType is null || teamNameRaw.Length == 0)
            {
                result.Errors.Add($"Row {line}: invalid or incomplete row");
                continue;
            }
            if (teamName is null)
            {
                result.Errors.Add($"Row {line}: unknown house \"{row.Get("team_name")}\"");
                continue;
            }

            string? winnerUuid = null;
            if (achievementType == AchievementTypes.BestPlayer && winnerStudentId.Length == 0)
            {
                result.Errors.Add($"Row {line}: winner_student_id required for Best Player");
                continue;
            }
            if (winnerStudentId.Length > 0)
            {
                if (!studentMap.TryGetValue(winnerStudentId, out winnerUuid))
                {
                    result.Errors.Add($"Row {line}: student \"{winnerStudentId}\" not found");
                    continue;
                }
            }

            prepared.Add((new AchievementPayload(meetYear.Value, sport, achievementType, teamName, notes), winnerUuid));
        }

        var ensured = await _achievements.EnsureImportedSportsAsync(prepared.Select(p => p.Achievement.Sport));
        if (ensured.Error is not null)
        {
            result.Errors.Add(ensured.Error);
            return result;
        }
        if (ensured.Canonical is { } canonical)
        {
            for (var i = 0; i < prepared.Count; i++)
            {
                var item = prepared[i];
                if (canonical.TryGetValue(item.Achievement.Sport.Trim().ToLowerInvariant(), out var name))
                    prepared[i] = (item.Achievement with { Sport = name }, item.WinnerUuid);
            }
        }

        foreach (var batch in Chunk(prepared, ImportBatchSize))
        {
            List<IdRow> inserted;
            try
            {
                inserted = await _db.InsertAsync<IdRow>("sports_achievements", batch.Select(p => p.Achievement).ToList(), "id");
            }
            catch (PostgrestException ex)
            {
                result.Errors.Add($"Batch insert: {ex.Message}");
                continue;
            }

            var winners = new List<WinnerPayload>();
            for (var idx = 0; idx < inserted.Count && idx < batch.Count; idx++)
            {
                if (batch[idx].WinnerUuid is { } winnerId) winners.Add(new WinnerPayload(inserted[idx].Id, winnerId));
            }

            foreach (var winnerBatch in Chunk(winners, ImportBatchSize))
            {
                try
                {
                    await _db.InsertAsync("sports_achievement_winners", winnerBatch);
                }
                catch (PostgrestException ex)
                {
                    result.Errors.Add($"Winners batch: {ex.Message}");
                }
            }

            result.Success += batch.Count;
            result.Inserted += batch.Count;
        }

        return result;
    }

    public async Task<ImportResult> ImportInventoryAsync(IReadOnlyList<ImportPreviewRow> rows)
    {
        if (NotSignedIn() is { } denied) return denied;
        var result = new ImportResult();

        List<NamedRow> existing;
        try
        {
            existing = await _db.GetAllPagesAsync<NamedRow>(() => PostgrestClient.From("inventory_items").Select("id, name"));
        }
        catch (PostgrestException ex)
        {
            result.Errors.Add($"Could not load inventory: {ex.Message}");
            return result;
        }

        var existingMap = new Dictionary<string, string>();
        foreach (var e in existing) existingMap[e.Name.ToLowerInvariant()] = e.Id;

        var toInsert = new List<InventoryInsertPayload>();
        var toUpdate = new List<(string Id, int Quantity)>();

        for (var i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var line = i + 2;
            var name = row.Get("item_name").Trim();
            var quantity = Formatting.ParseIntLoose(row.Get("quantity"));

            if (name.Length == 0)
            {
                result.Errors.Add($"Row {line}: missing item name");
                continue;
            }
            if (quantity is null || quantity < 0)
            {
                result.Errors.Add($"Row {line}: invalid quantity");
                continue;
            }

            var key = name.ToLowerInvariant();
            existingMap.TryGetValue(key, out var existingId);
            if (existingId is not null && !existingId.StartsWith("pending-", StringComparison.Ordinal))
            {
                var idx = toUpdate.FindIndex(u => u.Id == existingId);
                if (idx >= 0) toUpdate[idx] = (existingId, quantity.Value);
                else toUpdate.Add((existingId, quantity.Value));
            }
            else if (existingId is not null)
            {
                var idx = toInsert.FindIndex(item => item.Name.ToLowerInvariant() == key);
                if (idx >= 0) toInsert[idx] = new InventoryInsertPayload(name, quantity.Value);
                result.Skipped++;
            }
            else
            {
                toInsert.Add(new InventoryInsertPayload(name, quantity.Value));
                existingMap[key] = $"pending-{name}";
            }
        }

        foreach (var batch in Chunk(toInsert, ImportBatchSize))
        {
            try
            {
                var inserted = await _db.InsertAsync<NamedRow>("inventory_items", batch, "id, name");
                foreach (var item in inserted) existingMap[item.Name.ToLowerInvariant()] = item.Id;
                result.Success += batch.Count;
                result.Inserted += batch.Count;
            }
            catch (PostgrestException ex)
            {
                result.Errors.Add($"Batch insert: {ex.Message}");
            }
        }

        await RunUpdatesAsync(result, toUpdate
            .Select(u => (Func<Task>)(() => _db.UpdateAsync(
                PostgrestClient.From("inventory_items").Eq("id", u.Id),
                new InventoryQuantityPayload(u.Quantity, DateTime.UtcNow.ToString("o")))))
            .ToList());

        return result;
    }
}
