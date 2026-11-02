"use server";

import { dbError } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeFacultyCode } from "@/lib/faculties";
import { normalizeBatchName, sameBatchName } from "@/lib/batch-name";
import { getBatchSummary, type BatchSummary } from "@/lib/data/students-nav";

export type StudentSearchResult = {
  id: string;
  student_id: string | null;
  full_name: string;
  faculty: string | null;
  intake: string | null;
  houses: { name: string } | null;
};

const STUDENT_SEARCH_LIMIT = 50;

export async function searchStudents(
  query: string
): Promise<{ students: StudentSearchResult[] } | { error: string }> {
  // Characters that PostgREST reads as filter syntax inside or=(...).
  const term = query.replace(/[,()*\\%"']/g, "").trim();
  if (term.length < 2) return { students: [] };

  const pattern = `*${term}*`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, student_id, full_name, faculty, intake, houses(name)")
    .or(
      ["student_id", "full_name", "email", "nic", "mobile"]
        .map((column) => `${column}.ilike.${pattern}`)
        .join(",")
    )
    .order("full_name")
    .order("id")
    .limit(STUDENT_SEARCH_LIMIT);

  if (error) return { error: dbError(error) };
  return { students: (data ?? []) as unknown as StudentSearchResult[] };
}

function parseStudentForm(formData: FormData) {
  const serialRaw = String(formData.get("serial_no") ?? "").trim();
  const serialParsed = serialRaw ? parseInt(serialRaw, 10) : null;
  const facultyRaw = String(formData.get("faculty") ?? "").trim();

  return {
    student_id: String(formData.get("student_id") ?? "").trim() || null,
    full_name: String(formData.get("full_name") ?? "").trim(),
    house_id: String(formData.get("house_id") ?? "").trim() || null,
    serial_no:
      serialParsed !== null && !Number.isNaN(serialParsed) ? serialParsed : null,
    faculty: normalizeFacultyCode(facultyRaw) || null,
    intake: String(formData.get("intake") ?? "").trim() || null,
    degree_programme:
      String(formData.get("degree_programme") ?? "").trim() || null,
    university: String(formData.get("university") ?? "").trim() || null,
    title: String(formData.get("title") ?? "").trim() || null,
    gender: String(formData.get("gender") ?? "").trim() || null,
    nic: String(formData.get("nic") ?? "").trim() || null,
    mobile: String(formData.get("mobile") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
  };
}

export async function addStudent(formData: FormData) {
  const data = parseStudentForm(formData);

  if (!data.full_name) {
    return { error: "Name is required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("students").insert(data);

  if (error) {
    if (error.code === "23505") {
      return { error: "A student with this ID already exists." };
    }
    return { error: dbError(error) };
  }

  revalidatePath("/students", "page");
  return { success: true };
}

export async function updateStudent(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const data = parseStudentForm(formData);

  if (!id || !data.full_name) {
    return { error: "Name is required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("students").update(data).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A student with this ID already exists." };
    }
    return { error: dbError(error) };
  }

  revalidatePath("/students", "page");
  return { success: true };
}

export async function listBatches(): Promise<{ batches: BatchSummary[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const summary = await getBatchSummary(supabase);
  if (summary.error) return { error: summary.error };
  return { batches: summary.batches };
}

export async function renameBatch(
  oldName: string,
  newName: string
): Promise<{ success: true; count: number } | { error: string }> {
  const next = normalizeBatchName(newName);
  if ("error" in next) return { error: next.error };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const summary = await getBatchSummary(supabase);
  if (summary.error) return { error: summary.error };
  const current = summary.batches.find((batch) => batch.intake === oldName);
  if (!current) return { error: "That batch was not found." };
  if (sameBatchName(current.intake, next.name)) return { error: "That is already the batch name." };
  const clash = summary.batches.find((batch) => sameBatchName(batch.intake, next.name));
  if (clash) return { error: `A batch named "${clash.intake}" already exists.` };

  const { error } = await supabase.from("students").update({ intake: next.name }).eq("intake", current.intake);
  if (error) return { error: dbError(error) };

  const [{ count: oldLeft }, { count: nowNew }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("intake", current.intake),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("intake", next.name),
  ]);
  if ((oldLeft ?? 0) !== 0 || (nowNew ?? 0) !== current.total) {
    return {
      error: `Renamed students, but the check found ${nowNew ?? 0} in "${next.name}" and ${oldLeft ?? 0} still named "${current.intake}".`,
    };
  }

  revalidatePath("/students", "layout");
  return { success: true, count: current.total };
}

export async function deleteStudent(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid student." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) return { error: dbError(error) };

  revalidatePath("/students", "page");
  return { success: true };
}
