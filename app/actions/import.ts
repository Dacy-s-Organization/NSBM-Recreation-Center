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
import { requireSuper } from "@/lib/supabase/auth";
import { ensureImportedSports } from "@/lib/sports";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { ACHIEVEMENT_SECTIONS, parseSection } from "@/lib/achievement-sections";
import { normalizeBatchName } from "@/lib/batch-name";

type ImportResult = {
  success: number;
  inserted: number;
  updated: number;
  skipped: number;
  /** Students whose empty fields were filled. Set only by the student import. */
  filled?: number;
  /** Students that already had every supplied field. Set only by the student import. */
  unchanged?: number;
  /** Students where the file disagreed and the stored value was kept. */
  kept?: number;
  errors: string[];
  notices?: string[];
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
  full_name: string | null;
  serial_no: number | null;
  house_id: string | null;
  faculty: string | null;
  intake: string | null;
  degree_programme: string | null;
  university: string | null;
  title: string | null;
  gender: string | null;
  nic: string | null;
  mobile: string | null;
  email: string | null;
};

type StudentPayload = {
  student_id: string | null;
  full_name: string;
  house_id: string | null;
  serial_no: number | null;
  faculty: string | null;
  intake: string | null;
  degree_programme: string | null;
  university: string | null;
  title: string | null;
  gender: string | null;
  nic: string | null;
  mobile: string | null;
  email: string | null;
};

const STUDENT_FILL_FIELDS = [
  "full_name",
  "house_id",
  "serial_no",
  "faculty",
  "intake",
  "degree_programme",
  "university",
  "title",
  "gender",
  "nic",
  "mobile",
  "email",
] as const satisfies readonly (keyof StudentPayload)[];

type StudentFillField = (typeof STUDENT_FILL_FIELDS)[number];

const STUDENT_EXISTING_SELECT =
  "id, student_id, full_name, serial_no, house_id, faculty, intake, degree_programme, university, title, gender, nic, mobile, email";

function isEmptyStudentField(value: string | number | null | undefined) {
  if (value == null) return true;
  if (typeof value === "number") return Number.isNaN(value);
  return value.trim() === "";
}

function studentFieldsEqual(
  current: string | number | null | undefined,
  incoming: string | number | null | undefined
) {
  if (typeof current === "number" || typeof incoming === "number") {
    return current === incoming;
  }
  return (current ?? "").trim() === (incoming ?? "").trim();
}

function studentPayloadsMatch(a: StudentPayload, b: StudentPayload) {
  return (
    a.student_id === b.student_id &&
    STUDENT_FILL_FIELDS.every((field) => studentFieldsEqual(a[field], b[field]))
  );
}

/** Empty stored fields become the file value. A stored value is never replaced. */
function studentFillPlan(existing: StudentExisting, incoming: StudentPayload) {
  const patch: Partial<Record<StudentFillField, string | number>> = {};
  const kept: StudentFillField[] = [];

  for (const field of STUDENT_FILL_FIELDS) {
    const next = incoming[field];
    if (isEmptyStudentField(next)) continue;
    const current = existing[field];
    if (isEmptyStudentField(current)) {
      patch[field] = next as string | number;
      continue;
    }
    if (!studentFieldsEqual(current, next)) kept.push(field);
  }

  return { patch, kept };
}

function studentInsertPayload(row: StudentRow, houseId: string | null, batch: string): StudentPayload {
  const serialRaw = row.serial_no?.trim();
  const serialNo = serialRaw ? parseInt(serialRaw, 10) : null;

  return {
    student_id: row.student_id?.trim() || null,
    full_name: row.full_name.trim(),
    house_id: houseId,
    serial_no: serialNo !== null && !Number.isNaN(serialNo) ? serialNo : null,
    faculty: normalizeFacultyCode(row.faculty) || null,
    intake: batch,
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
  rows: StudentRow[],
  batch: string
): Promise<ImportResult> {
  const named = normalizeBatchName(batch);
  if ("error" in named) {
    return { ...emptyImportResult(), errors: [named.error] };
  }
  const auth = await requireSuper();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result: ImportResult = {
    ...emptyImportResult(),
    filled: 0,
    unchanged: 0,
    kept: 0,
    notices: [],
  };
  const note = (message: string) => {
    result.notices?.push(message);
  };

  const { data: houses } = await supabase.from("houses").select("id, name");
  const houseMap = buildHouseIdMap(houses ?? []);

  const { data: existingRows, error: existingError } = await fetchAllPages<StudentExisting>(
    (from, to) =>
      supabase.from("students").select(STUDENT_EXISTING_SELECT).range(from, to)
  );

  if (existingError) {
    result.errors.push(`Could not load existing students: ${existingError}`);
    return result;
  }

  const byStudentId = new Map<string, StudentExisting>();
  const bySerialContext = new Map<string, StudentExisting>();
  const ambiguousSerial = new Set<string>();

  function indexSerial(row: StudentExisting) {
    const key = serialContextKey(row.faculty, row.intake, row.serial_no);
    if (!key || ambiguousSerial.has(key)) return;
    if (bySerialContext.has(key)) {
      bySerialContext.delete(key);
      ambiguousSerial.add(key);
      return;
    }
    bySerialContext.set(key, row);
  }

  for (const row of existingRows) {
    if (row.student_id) byStudentId.set(row.student_id, row);
    indexSerial(row);
  }

  type IncomingStudent = { line: number; payload: StudentPayload };
  const incomingById = new Map<string, IncomingStudent>();
  const incomingWithoutId: IncomingStudent[] = [];

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

    const payload = studentInsertPayload(row, houseId, named.name);
    if (payload.student_id) {
      const earlier = incomingById.get(payload.student_id);
      if (!earlier) {
        incomingById.set(payload.student_id, { line, payload });
      } else if (studentPayloadsMatch(earlier.payload, payload)) {
        result.skipped++;
      } else {
        result.skipped++;
        note(
          `Row ${line}: Student ID ${payload.student_id} differs from row ${earlier.line}; the first row was kept.`
        );
      }
    } else {
      incomingWithoutId.push({ line, payload });
    }
  }

  const toInsert: StudentPayload[] = [];
  const toFill: {
    line: number;
    existing: StudentExisting;
    patch: Partial<Record<StudentFillField, string | number>>;
    kept: StudentFillField[];
  }[] = [];

  function queueExisting(line: number, existing: StudentExisting, payload: StudentPayload) {
    const { patch, kept } = studentFillPlan(existing, payload);
    const label = payload.student_id
      ? `Student ${payload.student_id}`
      : `Row ${line}`;
    if (kept.length > 0) {
      result.kept = (result.kept ?? 0) + 1;
      note(`${label}: kept existing ${kept.join(", ")}`);
    }
    if (Object.keys(patch).length === 0) {
      if (kept.length === 0) result.unchanged = (result.unchanged ?? 0) + 1;
      return;
    }
    toFill.push({ line, existing, patch, kept });
  }

  for (const { line, payload } of incomingById.values()) {
    const existing = byStudentId.get(payload.student_id as string);
    if (existing) queueExisting(line, existing, payload);
    else toInsert.push(payload);
  }

  for (const { line, payload } of incomingWithoutId) {
    const key = serialContextKey(payload.faculty, payload.intake, payload.serial_no);
    if (!key) {
      result.skipped++;
      note(`Row ${line}: no Student ID, so it was not imported.`);
      continue;
    }
    if (ambiguousSerial.has(key)) {
      result.skipped++;
      note(
        `Row ${line}: serial ${payload.serial_no} matches more than one student in ${payload.faculty} ${payload.intake}; skipped.`
      );
      continue;
    }
    const existing = bySerialContext.get(key);
    if (!existing) {
      result.skipped++;
      note(`Row ${line}: no Student ID and no single matching student; skipped.`);
      continue;
    }
    queueExisting(line, existing, payload);
  }

  async function insertPayload(payload: StudentPayload) {
    const { error } = await supabase.from("students").insert(payload);
    if (error) {
      result.errors.push(
        `Student ${payload.student_id ?? payload.full_name}: ${error.message}`
      );
      return;
    }
    result.success++;
    result.inserted++;
  }

  for (const batch of chunkArray(toInsert, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("students").insert(batch);
    if (!error) {
      result.success += batch.length;
      result.inserted += batch.length;
      continue;
    }
    for (const payload of batch) {
      await insertPayload(payload);
    }
  }

  for (const batch of chunkArray(toFill, 20)) {
    const applied = await Promise.all(
      batch.map(async ({ existing, patch }) => {
        let query = supabase.from("students").update(patch).eq("id", existing.id);
        for (const column of Object.keys(patch)) {
          query = query.is(column, null);
        }
        const { data, error } = await query.select("id");
        const label = existing.student_id
          ? `Student ${existing.student_id}`
          : existing.full_name ?? existing.id;
        if (error) {
          result.errors.push(`${label}: ${error.message}`);
          return false;
        }
        if (!data?.length) {
          note(`${label}: fill was not applied because a field was no longer empty.`);
          return false;
        }
        return true;
      })
    );
    for (const ok of applied) {
      if (!ok) continue;
      result.filled = (result.filled ?? 0) + 1;
      result.success++;
    }
  }

  revalidateStudents();
  return result;
}

export async function importRecords(
  rows: { student_id: string; track_name: string; value: string; year: string }[],
  rawSection: string
): Promise<ImportResult> {
  const section = parseSection(rawSection);
  if (!section) return { ...emptyImportResult(), errors: ["Unknown achievement section."] };
  const recordsTable = ACHIEVEMENT_SECTIONS[section].recordsTable;

  const auth = await requireSuper();
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
      .from(recordsTable)
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
    const { error } = await supabase.from(recordsTable).insert(batch);
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
        supabase.from(recordsTable).update({ value: item.value }).eq("id", item.id)
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
  rows: AchievementImportRow[],
  rawSection: string
): Promise<ImportResult> {
  const section = parseSection(rawSection);
  if (!section) return { ...emptyImportResult(), errors: ["Unknown achievement section."] };
  const { achievementsTable, winnersTable } = ACHIEVEMENT_SECTIONS[section];

  const auth = await requireSuper();
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
      team_name: string | null;
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
    const notes = row.notes?.trim() || null;
    const winnerStudentId = row.winner_student_id?.trim() ?? "";

    if (Number.isNaN(meetYear) || !sport || !achievementType) {
      result.errors.push(`Row ${line}: invalid or incomplete row`);
      continue;
    }
    let teamName: string | null = null;
    if (teamNameRaw) {
      teamName = resolveHouseName(teamNameRaw);
      if (!teamName) {
        result.errors.push(`Row ${line}: unknown house "${row.team_name}"`);
        continue;
      }
    }

    let winnerStudentUuid: string | null = null;
    if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER && !winnerStudentId) {
      result.errors.push(`Row ${line}: winner_student_id required for Best Player`);
      continue;
    }
    if (winnerStudentId) {
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

  const ensured = await ensureImportedSports(
    supabase,
    prepared.map((item) => item.achievement.sport)
  );
  if ("error" in ensured) {
    result.errors.push(ensured.error);
    return result;
  }
  for (const item of prepared) {
    const canonical = ensured.canonical.get(item.achievement.sport.trim().toLowerCase());
    if (canonical) item.achievement.sport = canonical;
  }

  for (const batch of chunkArray(prepared, IMPORT_BATCH_SIZE)) {
    const { data: inserted, error } = await supabase
      .from(achievementsTable)
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
          .from(winnersTable)
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
  const auth = await requireSuper();
  if (auth.error || !auth.supabase) {
    return { ...emptyImportResult(), errors: [auth.error ?? "Not signed in."] };
  }
  const supabase = auth.supabase;
  const result = emptyImportResult();

  const importPhase = "phase_01";
  const importCategory = "rec";

  const { data: existing, error: existingError } = await fetchAllPages<{
    id: string;
    name: string;
    phase: string;
    category: string;
  }>((from, to) =>
    supabase.from("inventory_items").select("id, name, phase, category").range(from, to)
  );

  if (existingError) {
    result.errors.push(`Could not load inventory: ${existingError}`);
    return result;
  }

  const inventoryKey = (phase: string, category: string, name: string) =>
    `${phase}\0${category}\0${name.toLowerCase()}`;

  const existingMap = new Map(
    existing.map((e) => [inventoryKey(e.phase, e.category, e.name), e.id])
  );

  const toInsert: { name: string; quantity: number; phase: string; category: string }[] = [];
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

    const key = inventoryKey(importPhase, importCategory, name);
    const existingId = existingMap.get(key);
    if (existingId && !existingId.startsWith("pending-")) {
      const updateIdx = toUpdate.findIndex((u) => u.id === existingId);
      if (updateIdx >= 0) toUpdate[updateIdx] = { id: existingId, quantity };
      else toUpdate.push({ id: existingId, quantity });
    } else if (existingId?.startsWith("pending-")) {
      const insertIdx = toInsert.findIndex(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      );
      if (insertIdx >= 0) {
        toInsert[insertIdx] = { name, quantity, phase: importPhase, category: importCategory };
      }
      result.skipped++;
    } else {
      toInsert.push({ name, quantity, phase: importPhase, category: importCategory });
      existingMap.set(key, `pending-${name}`);
    }
  }

  for (const batch of chunkArray(toInsert, IMPORT_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert(batch)
      .select("id, name, phase, category");
    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
    } else {
      data?.forEach((item) =>
        existingMap.set(inventoryKey(item.phase, item.category, item.name), item.id)
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
