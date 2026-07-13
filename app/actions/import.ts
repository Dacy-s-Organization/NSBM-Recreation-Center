"use server";

import { revalidatePath } from "next/cache";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  type AchievementType,
} from "@/lib/constants";
import { chunkArray, IMPORT_BATCH_SIZE } from "@/lib/batch-chunks";
import { buildHouseIdMap, lookupHouseId, resolveHouseName } from "@/lib/houses";
import { normalizeFacultyCode } from "@/lib/faculties";
import { getAuthedClient } from "@/lib/supabase/auth";
import { fetchAllPages } from "@/lib/supabase/fetch-all";

type ImportResult = {
  success: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function emptyImportResult(): ImportResult {
  return { success: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
}

type StudentRow = {
  serial_no?: string;
  student_id?: string;
  full_name: string;
  house_name?: string;
  faculty?: string;
  intake?: string;
  degree_programme?: string;
  university?: string;
  title?: string;
  gender?: string;
  nic?: string;
  mobile?: string;
  email?: string;
};

type StudentExisting = {
  id: string;
  student_id: string | null;
  serial_no: number | null;
  house_id: string | null;
  faculty: string | null;
  intake: string | null;
};

function studentInsertPayload(row: StudentRow, houseId: string | null) {
  const serialRaw = row.serial_no?.trim();
  const serialNo = serialRaw ? parseInt(serialRaw, 10) : null;

  return {
    student_id: row.student_id?.trim() || null,
    full_name: row.full_name.trim(),
    house_id: houseId,
    serial_no: serialNo !== null && !Number.isNaN(serialNo) ? serialNo : null,
    faculty: normalizeFacultyCode(row.faculty) || null,
    intake: row.intake?.trim() || null,
    degree_programme: row.degree_programme?.trim() || null,
    university: row.university?.trim() || null,
    title: row.title?.trim() || null,
    gender: row.gender?.trim() || null,
    nic: row.nic?.trim() || null,
    mobile: row.mobile?.trim() || null,
    email: row.email?.trim() || null,
  };
}

function serialContextKey(
  faculty: string | null | undefined,
  intake: string | null | undefined,
  serialNo: number | null | undefined
) {
  if (serialNo == null || !faculty || !intake) return null;
  return `${faculty}|${intake}|${serialNo}`;
}

function revalidateStudents() {
  revalidatePath("/students", "layout");
  revalidatePath("/", "page");
}

function revalidateAchievements() {
  revalidatePath("/achievements", "layout");
  revalidatePath("/", "page");
}

function revalidateInventory() {
  revalidatePath("/inventory", "layout");
  revalidatePath("/", "page");
}

export async function importStudents(
  rows: StudentRow[]
): Promise<ImportResult> {
  const auth = await getAuthedClient();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result = emptyImportResult();

  const { data: houses } = await supabase.from("houses").select("id, name");
  const houseMap = buildHouseIdMap(houses ?? []);

  const { data: existingRows, error: existingError } = await fetchAllPages<StudentExisting>(
    (from, to) =>
      supabase
        .from("students")
        .select("id, student_id, serial_no, house_id, faculty, intake")
        .range(from, to)
  );

  if (existingError) {
    result.errors.push(`Could not load existing students: ${existingError}`);
    return result;
  }

  const byStudentId = new Map<string, StudentExisting>();
  const bySerialContext = new Map<string, StudentExisting>();

  for (const row of existingRows) {
    if (row.student_id) byStudentId.set(row.student_id, row);
    const key = serialContextKey(row.faculty, row.intake, row.serial_no);
    if (key) bySerialContext.set(key, row);
  }

  const withId: ReturnType<typeof studentInsertPayload>[] = [];
  const withoutId: ReturnType<typeof studentInsertPayload>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const houseName = (row.house_name ?? "").trim();
    const houseId = houseName ? lookupHouseId(houseName, houseMap) : null;

    if (!row.full_name?.trim()) {
      result.errors.push(`Row ${line}: missing name or Student ID`);
      continue;
    }
    if (houseName && !houseId) {
      result.errors.push(`Row ${line}: unknown house "${row.house_name}"`);
      continue;
    }

    const payload = studentInsertPayload(row, houseId);
    const existingById = payload.student_id
      ? byStudentId.get(payload.student_id)
      : undefined;
    const contextKey = serialContextKey(
      payload.faculty,
      payload.intake,
      payload.serial_no
    );
    const existingBySerial = contextKey
      ? bySerialContext.get(contextKey)
      : undefined;
    const existing = existingById ?? existingBySerial;

    if (!payload.house_id && existing?.house_id) {
      payload.house_id = existing.house_id;
    }

    if (payload.student_id) {
      withId.push(payload);
    } else {
      withoutId.push(payload);
    }
  }

  // Last row wins when the same student_id appears twice in one CSV
  const dedupedWithId = [
    ...new Map(
      withId
        .filter((p) => p.student_id)
        .map((p) => [p.student_id as string, p])
    ).values(),
  ];
  if (dedupedWithId.length < withId.length) {
    result.skipped += withId.length - dedupedWithId.length;
  }

  for (const batch of chunkArray(dedupedWithId, IMPORT_BATCH_SIZE)) {
    let batchInserted = 0;
    let batchUpdated = 0;
    for (const payload of batch) {
      if (payload.student_id && byStudentId.has(payload.student_id)) {
        batchUpdated++;
      } else {
        batchInserted++;
      }
    }

    const { data: upserted, error } = await supabase
      .from("students")
      .upsert(batch, {
        onConflict: "student_id",
        ignoreDuplicates: false,
      })
      .select("id, student_id, serial_no, house_id, faculty, intake");

    if (error) {
      result.errors.push(`Batch upsert: ${error.message}`);
    } else {
      result.success += batch.length;
      result.inserted += batchInserted;
      result.updated += batchUpdated;
      for (const row of upserted ?? []) {
        const existing: StudentExisting = {
          id: row.id,
          student_id: row.student_id,
          serial_no: row.serial_no,
          house_id: row.house_id,
          faculty: row.faculty,
          intake: row.intake,
        };
        if (row.student_id) byStudentId.set(row.student_id, existing);
        const key = serialContextKey(row.faculty, row.intake, row.serial_no);
        if (key) bySerialContext.set(key, existing);
      }
    }
  }

  const toInsertNoId: ReturnType<typeof studentInsertPayload>[] = [];
  const toUpdateNoId: {
    id: string;
    payload: ReturnType<typeof studentInsertPayload>;
  }[] = [];

  for (const payload of withoutId) {
    const key = serialContextKey(
      payload.faculty,
      payload.intake,
      payload.serial_no
    );
    const existing = key ? bySerialContext.get(key) : undefined;
    if (existing?.id) {
      toUpdateNoId.push({ id: existing.id, payload });
    } else {
      toInsertNoId.push(payload);
    }
  }

  for (const batch of chunkArray(toInsertNoId, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("students").insert(batch);
    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
    } else {
      result.success += batch.length;
      result.inserted += batch.length;
    }
  }

  for (const batch of chunkArray(toUpdateNoId, 20)) {
    const results = await Promise.all(
      batch.map(({ id, payload }) =>
        supabase.from("students").update(payload).eq("id", id)
      )
    );
    for (const { error } of results) {
      if (error) {
        result.errors.push(`Update: ${error.message}`);
      } else {
        result.success++;
        result.updated++;
      }
    }
  }

  revalidateStudents();
  return result;
}

export async function importRecords(
  rows: { student_id: string; track_name: string; value: string; year: string }[]
): Promise<ImportResult> {
  const auth = await getAuthedClient();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result = emptyImportResult();

  const [{ data: students, error: studentsError }, { data: tracks, error: tracksError }] =
    await Promise.all([
      fetchAllPages<{ id: string; student_id: string | null }>((from, to) =>
        supabase.from("students").select("id, student_id").range(from, to)
      ),
      fetchAllPages<{ id: string; name: string }>((from, to) =>
        supabase.from("sport_tracks").select("id, name").range(from, to)
      ),
    ]);

  if (studentsError) {
    result.errors.push(`Could not load students: ${studentsError}`);
    return result;
  }
  if (tracksError) {
    result.errors.push(`Could not load tracks: ${tracksError}`);
    return result;
  }

  const studentMap = new Map(
    students
      .filter((s) => s.student_id)
      .map((s) => [s.student_id as string, s.id])
  );
  const trackMap = new Map(tracks.map((t) => [t.name.toLowerCase(), t.id]));

  const { data: existingRecords, error: recordsError } = await fetchAllPages<{
    id: string;
    student_id: string;
    track_id: string;
    year: number;
  }>((from, to) =>
    supabase
      .from("sport_records")
      .select("id, student_id, track_id, year")
      .range(from, to)
  );

  if (recordsError) {
    result.errors.push(`Could not load records: ${recordsError}`);
    return result;
  }

  const recordKey = (studentId: string, trackId: string, year: number) =>
    `${studentId}:${trackId}:${year}`;
  const existingRecordMap = new Map(
    existingRecords.map((r) => [
      recordKey(r.student_id, r.track_id, r.year),
      r.id,
    ])
  );

  const toInsert: {
    student_id: string;
    track_id: string;
    year: number;
    value: number;
  }[] = [];
  const toUpdate: { id: string; value: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const studentUuid = studentMap.get(row.student_id.trim());
    const trackId = trackMap.get(row.track_name.trim().toLowerCase());
    const value = parseFloat(row.value);
    const year = parseInt(row.year, 10);

    if (!studentUuid) {
      result.errors.push(`Row ${line}: student "${row.student_id}" not found`);
      continue;
    }
    if (!trackId) {
      result.errors.push(`Row ${line}: unknown track "${row.track_name}"`);
      continue;
    }
    if (Number.isNaN(value) || value < 0) {
      result.errors.push(`Row ${line}: invalid value`);
      continue;
    }
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      result.errors.push(`Row ${line}: invalid year`);
      continue;
    }

    const key = recordKey(studentUuid, trackId, year);
    const existingId = existingRecordMap.get(key);
    if (existingId && !existingId.startsWith("pending:")) {
      const updateIdx = toUpdate.findIndex((u) => u.id === existingId);
      if (updateIdx >= 0) toUpdate[updateIdx] = { id: existingId, value };
      else toUpdate.push({ id: existingId, value });
    } else if (existingId?.startsWith("pending:")) {
      const insertIdx = toInsert.findIndex(
        (item) => recordKey(item.student_id, item.track_id, item.year) === key
      );
      if (insertIdx >= 0) {
        toInsert[insertIdx] = {
          student_id: studentUuid,
          track_id: trackId,
          year,
          value,
        };
      }
      result.skipped++;
    } else {
      toInsert.push({
        student_id: studentUuid,
        track_id: trackId,
        year,
        value,
      });
      existingRecordMap.set(key, `pending:${key}`);
    }
  }

  for (const batch of chunkArray(toInsert, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("sport_records").insert(batch);
    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
    } else {
      result.success += batch.length;
      result.inserted += batch.length;
    }
  }

  for (const batch of chunkArray(toUpdate, 20)) {
    const results = await Promise.all(
      batch.map((item) =>
        supabase.from("sport_records").update({ value: item.value }).eq("id", item.id)
      )
    );
    for (const { error } of results) {
      if (error) {
        result.errors.push(`Update: ${error.message}`);
      } else {
        result.success++;
        result.updated++;
      }
    }
  }

  revalidateAchievements();
  return result;
}

type AchievementImportRow = {
  meet_year: string;
  sport: string;
  achievement_type: string;
  team_name: string;
  winner_student_id?: string;
  notes?: string;
};

function parseAchievementType(raw: string): AchievementType | null {
  const t = raw.trim();
  if ((ACHIEVEMENT_TYPES as readonly string[]).includes(t)) {
    return t as AchievementType;
  }
  return null;
}

export async function importAchievements(
  rows: AchievementImportRow[]
): Promise<ImportResult> {
  const auth = await getAuthedClient();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result = emptyImportResult();

  const { data: students, error: studentsError } = await fetchAllPages<{
    id: string;
    student_id: string | null;
  }>((from, to) =>
    supabase.from("students").select("id, student_id").range(from, to)
  );

  if (studentsError) {
    result.errors.push(`Could not load students: ${studentsError}`);
    return result;
  }

  const studentMap = new Map(
    students
      .filter((s) => s.student_id)
      .map((s) => [s.student_id as string, s.id])
  );

  type Prepared = {
    achievement: {
      meet_year: number;
      sport: string;
      achievement_type: AchievementType;
      team_name: string;
      notes: string | null;
    };
    winnerStudentUuid: string | null;
  };

  const prepared: Prepared[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const meetYear = parseInt(row.meet_year, 10);
    const sport = row.sport?.trim() ?? "";
    const achievementType = parseAchievementType(row.achievement_type ?? "");
    const teamNameRaw = row.team_name?.trim() ?? "";
    const teamName = resolveHouseName(teamNameRaw);
    const notes = row.notes?.trim() || null;
    const winnerStudentId = row.winner_student_id?.trim() ?? "";

    if (Number.isNaN(meetYear) || !sport || !achievementType || !teamNameRaw) {
      result.errors.push(`Row ${line}: invalid or incomplete row`);
      continue;
    }
    if (!teamName) {
      result.errors.push(`Row ${line}: unknown house "${row.team_name}"`);
      continue;
    }

    let winnerStudentUuid: string | null = null;
    if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
      if (!winnerStudentId) {
        result.errors.push(`Row ${line}: winner_student_id required for Best Player`);
        continue;
      }
      winnerStudentUuid = studentMap.get(winnerStudentId) ?? null;
      if (!winnerStudentUuid) {
        result.errors.push(`Row ${line}: student "${winnerStudentId}" not found`);
        continue;
      }
    }

    prepared.push({
      achievement: {
        meet_year: meetYear,
        sport,
        achievement_type: achievementType,
        team_name: teamName,
        notes,
      },
      winnerStudentUuid,
    });
  }

  for (const batch of chunkArray(prepared, IMPORT_BATCH_SIZE)) {
    const { data: inserted, error } = await supabase
      .from("sports_achievements")
      .insert(batch.map((p) => p.achievement))
      .select("id");

    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
      continue;
    }

    const winners: { achievement_id: string; student_id: string }[] = [];
    inserted?.forEach((ach, idx) => {
      const winnerId = batch[idx]?.winnerStudentUuid;
      if (winnerId) {
        winners.push({ achievement_id: ach.id, student_id: winnerId });
      }
    });

    if (winners.length > 0) {
      for (const winnerBatch of chunkArray(winners, IMPORT_BATCH_SIZE)) {
        const { error: winnerError } = await supabase
          .from("sports_achievement_winners")
          .insert(winnerBatch);
        if (winnerError) {
          result.errors.push(`Winners batch: ${winnerError.message}`);
        }
      }
    }

    result.success += batch.length;
    result.inserted += batch.length;
  }

  revalidateAchievements();
  return result;
}

export async function importInventory(
  rows: { item_name: string; quantity: string }[]
): Promise<ImportResult> {
  const auth = await getAuthedClient();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result = emptyImportResult();

  const { data: existing, error: existingError } = await fetchAllPages<{
    id: string;
    name: string;
  }>((from, to) =>
    supabase.from("inventory_items").select("id, name").range(from, to)
  );

  if (existingError) {
    result.errors.push(`Could not load inventory: ${existingError}`);
    return result;
  }

  const existingMap = new Map(
    existing.map((e) => [e.name.toLowerCase(), e.id])
  );

  const toInsert: { name: string; quantity: number }[] = [];
  const toUpdate: { id: string; quantity: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const name = row.item_name?.trim();
    const quantity = parseInt(row.quantity, 10);

    if (!name) {
      result.errors.push(`Row ${line}: missing item name`);
      continue;
    }
    if (Number.isNaN(quantity) || quantity < 0) {
      result.errors.push(`Row ${line}: invalid quantity`);
      continue;
    }

    const key = name.toLowerCase();
    const existingId = existingMap.get(key);
    if (existingId && !existingId.startsWith("pending-")) {
      const updateIdx = toUpdate.findIndex((u) => u.id === existingId);
      if (updateIdx >= 0) toUpdate[updateIdx] = { id: existingId, quantity };
      else toUpdate.push({ id: existingId, quantity });
    } else if (existingId?.startsWith("pending-")) {
      const insertIdx = toInsert.findIndex((item) => item.name.toLowerCase() === key);
      if (insertIdx >= 0) toInsert[insertIdx] = { name, quantity };
      result.skipped++;
    } else {
      toInsert.push({ name, quantity });
      existingMap.set(key, `pending-${name}`);
    }
  }

  for (const batch of chunkArray(toInsert, IMPORT_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert(batch)
      .select("id, name");
    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
    } else {
      data?.forEach((item) =>
        existingMap.set(item.name.toLowerCase(), item.id)
      );
      result.success += batch.length;
      result.inserted += batch.length;
    }
  }

  const updateChunks = chunkArray(toUpdate, 20);
  for (const batch of updateChunks) {
    const results = await Promise.all(
      batch.map((item) =>
        supabase
          .from("inventory_items")
          .update({ quantity: item.quantity, updated_at: new Date().toISOString() })
          .eq("id", item.id)
      )
    );
    for (const { error } of results) {
      if (error) {
        result.errors.push(`Update: ${error.message}`);
      } else {
        result.success++;
        result.updated++;
      }
    }
  }

  revalidateInventory();
  return result;
}
