"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ImportResult = {
  success: number;
  skipped: number;
  errors: string[];
};

export async function importStudents(
  rows: { student_id: string; full_name: string; house_name: string }[]
): Promise<ImportResult> {
  const supabase = await createClient();
  const result: ImportResult = { success: 0, skipped: 0, errors: [] };

  const { data: houses } = await supabase.from("houses").select("id, name");
  const houseMap = new Map(houses?.map((h) => [h.name.toLowerCase(), h.id]) ?? []);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    const houseId = houseMap.get(row.house_name.trim().toLowerCase());

    if (!row.student_id?.trim() || !row.full_name?.trim()) {
      result.errors.push(`Row ${line}: missing student_id or full_name`);
      continue;
    }
    if (!houseId) {
      result.errors.push(`Row ${line}: unknown house "${row.house_name}"`);
      continue;
    }

    const { error } = await supabase.from("students").insert({
      student_id: row.student_id.trim(),
      full_name: row.full_name.trim(),
      house_id: houseId,
    });

    if (error) {
      if (error.code === "23505") {
        result.skipped++;
      } else {
        result.errors.push(`Row ${line}: ${error.message}`);
      }
    } else {
      result.success++;
    }
  }

  revalidatePath("/students");
  revalidatePath("/");
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

  const studentMap = new Map(students?.map((s) => [s.student_id, s.id]) ?? []);
  const trackMap = new Map(tracks?.map((t) => [t.name.toLowerCase(), t.id]) ?? []);

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

    const { error } = await supabase.from("sport_records").insert({
      student_id: studentUuid,
      track_id: trackId,
      year,
      value,
    });

    if (error) {
      result.errors.push(`Row ${line}: ${error.message}`);
    } else {
      result.success++;
    }
  }

  revalidatePath("/records");
  revalidatePath("/");
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
      const { error } = await supabase
        .from("inventory_items")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", existingId);
      if (error) {
        result.errors.push(`Row ${line}: ${error.message}`);
      } else {
        result.success++;
      }
    } else {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({ name, quantity })
        .select("id, name")
        .single();
      if (error) {
        result.errors.push(`Row ${line}: ${error.message}`);
      } else {
        existingMap.set(data.name.toLowerCase(), data.id);
        result.success++;
      }
    }
  }

  revalidatePath("/inventory");
  revalidatePath("/");
  return result;
}
