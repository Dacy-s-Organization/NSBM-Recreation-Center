import { createClient } from "@/lib/supabase/server";
import { InventoryClient } from "@/components/inventory-client";
import type { InventoryItem } from "@/lib/types/database";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("inventory_items")
    .select("id, name, quantity, updated_at")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Inventory</h2>
        <p className="mt-1 text-zinc-600">
          Track equipment quantities. Add new items or edit existing counts.
        </p>
      </div>
      <InventoryClient items={(items ?? []) as InventoryItem[]} />
    </div>
  );
}
