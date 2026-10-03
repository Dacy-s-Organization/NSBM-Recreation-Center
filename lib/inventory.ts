export const INVENTORY_PHASES = [
  { id: "phase_01", label: "Phase 01" },
  { id: "phase_02", label: "Phase 02" },
] as const;

export const INVENTORY_CATEGORIES = [
  { id: "rec", label: "Rec Inventory" },
  { id: "gym", label: "Gym Inventory" },
] as const;

export type InventoryPhase = (typeof INVENTORY_PHASES)[number]["id"];
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]["id"];

export function isInventoryPhase(value: string): value is InventoryPhase {
  return INVENTORY_PHASES.some((phase) => phase.id === value);
}

export function isInventoryCategory(value: string): value is InventoryCategory {
  return INVENTORY_CATEGORIES.some((category) => category.id === value);
}
