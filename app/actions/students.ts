"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addStudent(formData: FormData) {
  const studentId = String(formData.get("student_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const houseId = String(formData.get("house_id") ?? "").trim();

  if (!studentId || !fullName || !houseId) {
    return { error: "All fields are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("students").insert({
    student_id: studentId,
    full_name: fullName,
    house_id: houseId,
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
