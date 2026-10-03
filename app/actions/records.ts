"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENT_SECTIONS, parseSection } from "@/lib/achievement-sections";
import { removeCertificateFiles, settleReference, storeCertificateFiles } from "@/app/actions/certificates";

const INVALID_SECTION = "Unknown achievement section.";

export async function addSportRecord(formData: FormData) {
  const section = parseSection(formData.get("section"));
  if (!section) return { error: INVALID_SECTION };
  const config = ACHIEVEMENT_SECTIONS[section];

  const studentIdText = String(formData.get("student_id") ?? "").trim();
  const trackId = String(formData.get("track_id") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();

  const value = parseFloat(valueRaw);
  const year = parseInt(yearRaw, 10);

  if (!studentIdText || !trackId || Number.isNaN(value) || value < 0) {
    return { error: "Please provide a valid student ID, track, and value." };
  }
  if (Number.isNaN(year) || year < 1900 || year > 2100) {
    return { error: "Please provide a valid year." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("student_id", studentIdText)
    .maybeSingle();

  if (studentError || !student) {
    return { error: "Student not found. Add them first or check the ID." };
  }

  const { data: created, error } = await supabase
    .from(config.recordsTable)
    .insert({
      student_id: student.id,
      track_id: trackId,
      year,
      value,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "The record could not be saved." };
  }

  const settled = await settleReference(
    supabase,
    config.recordRefColumn,
    created.id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) {
    await supabase.from(config.recordsTable).delete().eq("id", created.id);
    return { error: settled.error };
  }

  const fileError = await storeCertificateFiles(supabase, settled.reference, formData);
  revalidatePath("/achievements", "layout");
  if (fileError) {
    return { error: `The record was saved as ${settled.reference}, but a certificate could not be stored: ${fileError}` };
  }
  return { success: true };
}

export async function updateSportRecord(formData: FormData) {
  const section = parseSection(formData.get("section"));
  if (!section) return { error: INVALID_SECTION };
  const config = ACHIEVEMENT_SECTIONS[section];

  const id = String(formData.get("id") ?? "").trim();
  const studentIdText = String(formData.get("student_id") ?? "").trim();
  const trackId = String(formData.get("track_id") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();

  const value = parseFloat(valueRaw);
  const year = parseInt(yearRaw, 10);

  if (!id || !studentIdText || !trackId || Number.isNaN(value) || value < 0) {
    return { error: "Please provide a valid student ID, track, and value." };
  }
  if (Number.isNaN(year) || year < 1900 || year > 2100) {
    return { error: "Please provide a valid year." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("student_id", studentIdText)
    .maybeSingle();

  if (studentError || !student) {
    return { error: "Student not found. Check the ID." };
  }

  const settled = await settleReference(
    supabase,
    config.recordRefColumn,
    id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) return { error: settled.error };

  const { error } = await supabase
    .from(config.recordsTable)
    .update({
      student_id: student.id,
      track_id: trackId,
      year,
      value,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  const removeError = await removeCertificateFiles(supabase, formData);
  if (removeError) return { error: removeError };
  const fileError = await storeCertificateFiles(supabase, settled.reference, formData);
  revalidatePath("/achievements", "layout");
  if (fileError) return { error: fileError };
  return { success: true };
}

export async function deleteSportRecord(id: string, rawSection: string) {
  if (!id?.trim()) {
    return { error: "Invalid record." };
  }
  const section = parseSection(rawSection);
  if (!section) return { error: INVALID_SECTION };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase
    .from(ACHIEVEMENT_SECTIONS[section].recordsTable)
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/achievements", "layout");
  return { success: true };
}

export async function lookupStudentByStudentId(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("student_id, full_name, nic, houses(name)")
    .eq("student_id", studentId.trim())
    .maybeSingle();

  return data;
}
