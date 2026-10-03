import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENT_SECTIONS, type AchievementSection } from "@/lib/achievement-sections";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export function resolveSelectedYear(raw: string | undefined) {
  const defaultYear = new Date().getFullYear();
  const selectedYear = parseInt(raw ?? String(defaultYear), 10) || defaultYear;
  return { defaultYear, selectedYear };
}

export async function getSectionYears(
  supabase: Supabase,
  section: AchievementSection,
  selectedYear: number,
  defaultYear: number
): Promise<number[]> {
  const { data } = await supabase.rpc(ACHIEVEMENT_SECTIONS[section].yearsRpc);
  const stored = ((data ?? []) as { year: number }[])
    .map((row) => Number(row.year))
    .filter((year) => Number.isInteger(year));
  return [...new Set([...stored, selectedYear, defaultYear])].sort((a, b) => b - a);
}
