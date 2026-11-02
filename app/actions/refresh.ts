"use server";

import { revalidatePath } from "next/cache";
import { getStaffRole } from "@/lib/supabase/auth";

const lastRefresh = new Map<string, number>();
const refreshCooldownMs = 10_000;

/** Clear cached page data so lists reflect the latest database state. */
export async function refreshAppData() {
  const auth = await getStaffRole();
  if (!auth.user || (auth.role !== "mic" && auth.role !== "super")) return;
  const now = Date.now();
  const previous = lastRefresh.get(auth.user.id) ?? 0;
  if (now - previous < refreshCooldownMs) return;
  lastRefresh.set(auth.user.id, now);
  revalidatePath("/", "layout");
}
