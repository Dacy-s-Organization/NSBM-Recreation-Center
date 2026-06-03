"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addInventoryItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = parseInt(quantityRaw, 10);

  if (!name) {
    return { error: "Item name is required." };
  }
  if (Number.isNaN(quantity) || quantity < 0) {
    return { error: "Quantity must be a non-negative number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({ name, quantity });

  if (error) {
    if (error.code === "23505") {
      return { error: "An item with this name already exists. Edit it instead." };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}

export async function updateInventoryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = parseInt(quantityRaw, 10);

  if (!id || !name) {
    return { error: "Invalid item." };
  }
  if (Number.isNaN(quantity) || quantity < 0) {
    return { error: "Quantity must be a non-negative number." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, quantity, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { success: true };
}

export async function deleteInventoryItem(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid item." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath("/");
  return { success: true };
}
