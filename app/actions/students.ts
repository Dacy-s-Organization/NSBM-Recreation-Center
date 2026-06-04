"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function parseStudentForm(formData: FormData) {
  const serialRaw = String(formData.get("serial_no") ?? "").trim();
  const serialParsed = serialRaw ? parseInt(serialRaw, 10) : null;

  return {
    student_id: String(formData.get("student_id") ?? "").trim() || null,
    full_name: String(formData.get("full_name") ?? "").trim(),
    house_id: String(formData.get("house_id") ?? "").trim() || null,
    serial_no:
      serialParsed !== null && !Number.isNaN(serialParsed) ? serialParsed : null,
    faculty: String(formData.get("faculty") ?? "").trim() || null,
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

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert(data);

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

export async function updateStudent(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const data = parseStudentForm(formData);

  if (!id || !data.full_name) {
    return { error: "Name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").update(data).eq("id", id);

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
