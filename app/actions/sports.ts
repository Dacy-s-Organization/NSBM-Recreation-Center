"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { addNewSport } from "@/lib/sports";

export async function addSport(formData: FormData) {
  const name = String(formData.get("name") ?? "");

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };

  const result = await addNewSport(gate.supabase, name);
  if ("error" in result) return { error: result.error };

  revalidatePath("/achievements", "layout");
  return { success: true };
}

export async function deleteSport(id: string) {
  if (!id?.trim()) return { error: "Invalid sport." };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };

  const { data, error } = await gate.supabase.from("sports").delete().eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "The sport could not be deleted. Check that you have permission." };

  revalidatePath("/achievements", "layout");
  return { success: true };
}
