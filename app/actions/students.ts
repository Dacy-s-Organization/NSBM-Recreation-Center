"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStudent(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const houseId = String(formData.get("house_id") ?? "").trim();
  const faculty = String(formData.get("faculty") ?? "").trim() || null;
  const intake = String(formData.get("intake") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;

  if (!studentId || !fullName || !houseId) {
    return { error: "Student ID, name, and house are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    student_id: studentId,
    full_name: fullName,
    house_id: houseId,
    faculty,
    intake,
    gender,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A student with this ID already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/students");
  revalidatePath("/");
  return { success: true };
}

export async function updateStudent(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const houseId = String(formData.get("house_id") ?? "").trim();
  const faculty = String(formData.get("faculty") ?? "").trim() || null;
  const intake = String(formData.get("intake") ?? "").trim() || null;
  const gender = String(formData.get("gender") ?? "").trim() || null;

  if (!id || !studentId || !fullName || !houseId) {
    return { error: "Student ID, name, and house are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      student_id: studentId,
      full_name: fullName,
      house_id: houseId,
      faculty,
      intake,
      gender,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "A student with this ID already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/students");
  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}

export async function deleteStudent(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid student." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/students");
  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}
