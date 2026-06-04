"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSportTrack(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const lowerIsBetter = formData.get("lower_is_better") === "on";

  if (!name) {
    return { error: "Track name is required." };
  }
  if (!unit) {
    return { error: "Unit is required (e.g. s for seconds, m for meters)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sport_tracks").insert({
    name,
    unit,
    lower_is_better: lowerIsBetter,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A track with this name already exists." };
    }
    return { error: error.message };
  }

  revalidatePath("/achievements", "page");
  return { success: true };
}

export async function deleteSportTrack(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid track." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sport_tracks").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error: "Cannot delete: this track has athletic records. Remove those records first.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/achievements", "page");
  return { success: true };
}
