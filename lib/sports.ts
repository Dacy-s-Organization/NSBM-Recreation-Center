import { createClient } from "@/lib/supabase/server";
import { NEW_SPORT_VALUE } from "@/lib/constants";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type SportRow = { name: string; sort_order: number };

const duplicateMessage = (name: string) =>
  `"${name}" is already in the sport list. Choose it from the menu.`;

async function loadSports(supabase: Supabase): Promise<{ rows: SportRow[] } | { error: string }> {
  const { data, error } = await supabase.from("sports").select("name, sort_order");
  if (error) return { error: error.message };
  return { rows: (data ?? []) as SportRow[] };
}

export async function resolveChosenSport(
  supabase: Supabase,
  sport: string,
  newSport: string
): Promise<{ name: string } | { error: string }> {
  if (sport !== NEW_SPORT_VALUE) {
    const trimmed = sport.trim();
    if (!trimmed) return { error: "Sport, achievement type, and year are required." };
    return { name: trimmed };
  }
  return addNewSport(supabase, newSport);
}

export async function addNewSport(
  supabase: Supabase,
  name: string
): Promise<{ name: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter a name for the new sport." };

  const loaded = await loadSports(supabase);
  if ("error" in loaded) return loaded;

  const match = loaded.rows.find((row) => row.name.toLowerCase() === trimmed.toLowerCase());
  if (match) return { error: duplicateMessage(match.name) };

  const sortOrder = loaded.rows.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
  const { error } = await supabase.from("sports").insert({ name: trimmed, sort_order: sortOrder });
  if (error) {
    if (error.code === "23505") return { error: duplicateMessage(trimmed) };
    return { error: error.message };
  }
  return { name: trimmed };
}

export async function ensureImportedSports(
  supabase: Supabase,
  names: string[]
): Promise<{ canonical: Map<string, string> } | { error: string }> {
  const loaded = await loadSports(supabase);
  if ("error" in loaded) return loaded;

  const known = new Map(loaded.rows.map((row) => [row.name.toLowerCase(), row.name]));
  let sortOrder = loaded.rows.reduce((max, row) => Math.max(max, row.sort_order), 0);
  const pending: { name: string; sort_order: number }[] = [];

  for (const raw of names) {
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || known.has(key)) continue;
    sortOrder += 1;
    pending.push({ name: trimmed, sort_order: sortOrder });
    known.set(key, trimmed);
  }

  if (pending.length > 0) {
    const { error } = await supabase.from("sports").insert(pending);
    if (error && error.code !== "23505") return { error: error.message };
  }

  return { canonical: known };
}
