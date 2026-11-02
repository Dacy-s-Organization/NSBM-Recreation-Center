"use server";

import { dbError } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import { isInventoryCategory, isInventoryPhase } from "@/lib/inventory";
import { requireSuper } from "@/lib/supabase/auth";

function inventoryPlacement(formData: FormData) {
  const phase = String(formData.get("phase") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!isInventoryPhase(phase) || !isInventoryCategory(category)) {
    return { error: "Choose a phase and inventory." as const };
  }
  return { phase, category };
}

export async function addInventoryItem(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = parseInt(quantityRaw, 10);
  const placement = inventoryPlacement(formData);

  if (!name) {
    return { error: "Item name is required." };
  }
  if (Number.isNaN(quantity) || quantity < 0) {
    return { error: "Quantity must be a non-negative number." };
  }
  if ("error" in placement) return { error: placement.error };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("inventory_items").insert({
    name,
    quantity,
    phase: placement.phase,
    category: placement.category,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "An item with this name already exists in this inventory. Edit it instead." };
    }
    return { error: dbError(error) };
  }

  revalidatePath("/inventory", "page");
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

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase
    .from("inventory_items")
    .update({ name, quantity, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "An item with this name already exists in this inventory." };
    }
    return { error: dbError(error) };
  }

  revalidatePath("/inventory", "page");
  return { success: true };
}

export async function deleteInventoryItem(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid item." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);

  if (error) return { error: dbError(error) };

  revalidatePath("/inventory", "page");
  return { success: true };
}
