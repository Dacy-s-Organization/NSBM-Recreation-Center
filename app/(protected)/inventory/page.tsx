import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/supabase/auth";
import { InventoryClient } from "@/components/inventory-client";
import type { InventoryItem } from "@/lib/types/database";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { role } = await getStaffRole();
  const canEdit = role === "super";
  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, updated_at, phase, category")
    .order("name");

  return (
    <InventoryClient
      header={
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Inventory</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {canEdit
              ? "Track equipment quantities. Add new items or edit existing counts."
              : "Track equipment quantities."}
          </p>
        </div>
      }
      items={(items ?? []) as InventoryItem[]}
      canEdit={canEdit}
    />
  );
}
