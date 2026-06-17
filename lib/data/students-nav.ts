import type { SupabaseClient } from "@supabase/supabase-js";
import { NSBM_FACULTIES } from "@/lib/faculties";

export type FacultyCard = {
  code: string;
  name: string;
  description: string;
  count: number;
};

export type IntakeCard = {
  intake: string;
  count: number;
};

export async function getFacultyCards(
  supabase: SupabaseClient
): Promise<FacultyCard[]> {
  const { data } = await supabase.from("students").select("faculty");

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const code = row.faculty?.trim();
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return NSBM_FACULTIES.map((faculty) => ({
    code: faculty.code,
    name: faculty.name,
    description: faculty.description,
    count: counts.get(faculty.code) ?? 0,
  }));
}

export async function getIntakeCards(
  supabase: SupabaseClient,
  faculty: string
): Promise<IntakeCard[]> {
  const { data } = await supabase
    .from("students")
    .select("intake")
    .eq("faculty", faculty);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const intake = row.intake?.trim();
    if (!intake) continue;
    counts.set(intake, (counts.get(intake) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([intake, count]) => ({ intake, count }))
    .sort((a, b) => b.intake.localeCompare(a.intake));
}
