import { createClient } from "@/lib/supabase/server";
import { ACHIEVEMENT_SECTIONS, type AchievementSection } from "@/lib/achievement-sections";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SectionYearsKind = "achievements" | "records";

export function resolveSelectedYear(raw: string | undefined) {
  const defaultYear = new Date().getFullYear();
  const selectedYear = parseInt(raw ?? String(defaultYear), 10) || defaultYear;
  return { defaultYear, selectedYear };
}

export async function getSectionYears(
  supabase: Supabase,
  section: AchievementSection,
  kind: SectionYearsKind,
  selectedYear: number,
  defaultYear: number
): Promise<number[]> {
  const config = ACHIEVEMENT_SECTIONS[section];
  const [table, column] =
    kind === "achievements"
      ? [config.achievementsTable, "meet_year"]
      : [config.recordsTable, "year"];
  const { data } = await supabase.from(table).select(column);
  const stored = ((data ?? []) as unknown as Record<string, unknown>[])
    .map((row) => Number(row[column]))
    .filter((year) => Number.isInteger(year));
  return [...new Set([...stored, selectedYear, defaultYear])].sort((a, b) => b - a);
}
