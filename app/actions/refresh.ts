"use server";

import { revalidatePath } from "next/cache";

/** Clear cached page data so lists reflect the latest database state. */
export async function refreshAppData() {
  revalidatePath("/", "layout");
}
