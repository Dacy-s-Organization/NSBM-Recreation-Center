"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSportRecord(formData: FormData) {
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

  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id")
    .eq("student_id", studentIdText)
    .maybeSingle();

  if (studentError || !student) {
    return { error: "Student not found. Add them first or check the ID." };
  }

  const { error } = await supabase.from("sport_records").insert({
    student_id: student.id,
    track_id: trackId,
    year,
    value,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/records");
  revalidatePath("/");
  return { success: true };
}

export async function lookupStudentByStudentId(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("student_id, full_name, houses(name)")
    .eq("student_id", studentId.trim())
    .maybeSingle();

  return data;
}
