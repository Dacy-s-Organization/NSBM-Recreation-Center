/** Recreation center house names and CSV/import aliases */

export const HOUSE_NAMES = ["Ruby", "Citrine", "Emerald", "Sapphire"] as const;
export type HouseName = (typeof HOUSE_NAMES)[number];

const LEGACY_HOUSE_ALIASES: Record<string, HouseName> = {
  "ruby adventurers": "Ruby",
  "citrine warriors": "Citrine",
  "emerald fighters": "Emerald",
  "sapphire heroes": "Sapphire",
};

export function resolveHouseName(input: string): HouseName | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const exact = HOUSE_NAMES.find((name) => name.toLowerCase() === value);
  if (exact) return exact;

  if (LEGACY_HOUSE_ALIASES[value]) return LEGACY_HOUSE_ALIASES[value];

  const prefix = HOUSE_NAMES.find((name) => value.startsWith(name.toLowerCase()));
  return prefix ?? null;
}

export function buildHouseIdMap(houses: { id: string; name: string }[]) {
  const map = new Map<string, string>();
  for (const house of houses) {
    const canonical = resolveHouseName(house.name) ?? house.name;
    map.set(canonical.toLowerCase(), house.id);
    map.set(house.name.toLowerCase(), house.id);
  }
  return map;
}

export function lookupHouseId(
  houseName: string,
  houseIdMap: Map<string, string>
): string | null {
  const canonical = resolveHouseName(houseName);
  if (!canonical) return null;
  return houseIdMap.get(canonical.toLowerCase()) ?? null;
}
