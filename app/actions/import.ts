"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  type AchievementType,
} from "@/lib/constants";
import { chunkArray, IMPORT_BATCH_SIZE } from "@/lib/batch-chunks";

type ImportResult = {
  success: number;
  skipped: number;
  errors: string[];
};

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

function studentInsertPayload(row: StudentRow, houseId: string | null) {
  const serialRaw = row.serial_no?.trim();
  const serialNo = serialRaw ? parseInt(serialRaw, 10) : null;

  return {
    student_id: row.student_id?.trim() || null,
    full_name: row.full_name.trim(),
    house_id: houseId,
    serial_no: serialNo !== null && !Number.isNaN(serialNo) ? serialNo : null,
    faculty: row.faculty?.trim() || null,
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

function revalidateStudents() {
  revalidatePath("/students", "page");
}

function revalidateAchievements() {
  revalidatePath("/achievements", "page");
}

function revalidateInventory() {
  revalidatePath("/inventory", "page");
}

export async function importStudents(
  rows: StudentRow[]
): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  const { data: houses } = await supabase.from("houses").select("id, name");
  const houseMap = new Map(houses?.map((h) => [h.name.toLowerCase(), h.id]) ?? []);

  const withId: ReturnType<typeof studentInsertPayload>[] = [];
  const withoutId: ReturnType<typeof studentInsertPayload>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const houseName = (row.house_name ?? "").trim();
    const houseId = houseName
      ? houseMap.get(houseName.toLowerCase()) ?? null
      : null;

    if (!row.full_name?.trim()) {
      result.errors.push(`Row ${line}: missing name or Student No`);
      continue;
    }
    if (houseName && !houseId) {
      result.errors.push(`Row ${line}: unknown house "${row.house_name}"`);
      continue;
    }

    const payload = studentInsertPayload(row, houseId);
    if (payload.student_id) {
      withId.push(payload);
    } else {
      withoutId.push(payload);
    }
  }

  for (const batch of chunkArray(withId, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("students").upsert(batch, {
      onConflict: "student_id",
    });
    if (error) {
      result.errors.push(`Batch upsert: ${error.message}`);
    } else {
      result.success += batch.length;
    }
  }

  for (const batch of chunkArray(withoutId, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("students").insert(batch);
    if (error) {
      if (error.code === "23505") {
        result.skipped += batch.length;
      } else {
        result.errors.push(`Batch insert: ${error.message}`);
      }
    } else {
      result.success += batch.length;
    }
  }

  revalidateStudents();
  return result;
}

export async function importRecords(
  rows: { student_id: string; track_name: string; value: string; year: string }[]
): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  const [{ data: students }, { data: tracks }] = await Promise.all([
    supabase.from("students").select("id, student_id"),
    supabase.from("sport_tracks").select("id, name"),
  ]);

  const studentMap = new Map(
    students
      ?.filter((s) => s.student_id)
      .map((s) => [s.student_id as string, s.id]) ?? []
  );
  const trackMap = new Map(tracks?.map((t) => [t.name.toLowerCase(), t.id]) ?? []);

  const toInsert: {
    student_id: string;
    track_id: string;
    year: number;
    value: number;
  }[] = [];

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
    if (Number.isNaN(year)) {
      result.errors.push(`Row ${line}: invalid year`);
      continue;
    }

    toInsert.push({
      student_id: studentUuid,
      track_id: trackId,
      year,
      value,
    });
  }

  for (const batch of chunkArray(toInsert, IMPORT_BATCH_SIZE)) {
    const { error } = await supabase.from("sport_records").insert(batch);
    if (error) {
      result.errors.push(`Batch insert: ${error.message}`);
    } else {
      result.success += batch.length;
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
  const supabase = await createClient();
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  const { data: students } = await supabase
    .from("students")
    .select("id, student_id");
  const studentMap = new Map(
    students
      ?.filter((s) => s.student_id)
      .map((s) => [s.student_id as string, s.id]) ?? []
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
    const teamName = row.team_name?.trim() ?? "";
    const notes = row.notes?.trim() || null;
    const winnerStudentId = row.winner_student_id?.trim() ?? "";

    if (Number.isNaN(meetYear) || !sport || !achievementType || !teamName) {
      result.errors.push(`Row ${line}: invalid or incomplete row`);
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
  }

  revalidateAchievements();
  return result;
}

export async function importInventory(
  rows: { item_name: string; quantity: string }[]
): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  const { data: existing } = await supabase.from("inventory_items").select("id, name");
  const existingMap = new Map(
    existing?.map((e) => [e.name.toLowerCase(), e.id]) ?? []
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

    const existingId = existingMap.get(name.toLowerCase());
    if (existingId) {
      toUpdate.push({ id: existingId, quantity });
    } else {
      toInsert.push({ name, quantity });
      existingMap.set(name.toLowerCase(), `pending-${name}`);
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
      }
    }
  }

  revalidateInventory();
  return result;
}
