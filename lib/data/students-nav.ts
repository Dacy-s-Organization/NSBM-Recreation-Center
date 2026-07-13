import type { SupabaseClient } from "@supabase/supabase-js";
import { NSBM_FACULTIES, normalizeFacultyCode } from "@/lib/faculties";

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
  // Exact counts per faculty (avoids PostgREST 1000-row select cap)
  const counts = await Promise.all(
    NSBM_FACULTIES.map(async (faculty) => {
      const codes =
        faculty.code === "FOS" ? ["FOS", "FOSM"] : [faculty.code];
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("faculty", codes);
      return [faculty.code, count ?? 0] as const;
    })
  );

  const countMap = new Map(counts);

  return NSBM_FACULTIES.map((faculty) => ({
    code: faculty.code,
    name: faculty.name,
    description: faculty.description,
    count: countMap.get(faculty.code) ?? 0,
  }));
}

export async function getIntakeCards(
  supabase: SupabaseClient,
  faculty: string
): Promise<IntakeCard[]> {
  const normalized = normalizeFacultyCode(faculty) || faculty;
  const codes = normalized === "FOS" ? ["FOS", "FOSM"] : [normalized];

  // Distinct intakes via paginated select of intake only
  const intakes = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("students")
      .select("intake")
      .in("faculty", codes)
      .range(from, from + pageSize - 1);
    if (error) break;
    const rows = data ?? [];
    for (const row of rows) {
      const intake = row.intake?.trim();
      if (intake) intakes.add(intake);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const cards = await Promise.all(
    [...intakes].map(async (intake) => {
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .in("faculty", codes)
        .eq("intake", intake);
      return { intake, count: count ?? 0 };
    })
  );

  return cards.sort((a, b) => b.intake.localeCompare(a.intake));
}
