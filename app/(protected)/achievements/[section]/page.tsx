import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { AchievementsClient } from "@/components/achievements-client";
import { getHouses, getSports, getSportTracks } from "@/lib/data/reference";
import { getSectionYears, resolveSelectedYear } from "@/lib/data/achievement-years";
import { getStaffRole } from "@/lib/supabase/auth";
import {
  ACHIEVEMENT_SECTIONS,
  ACHIEVEMENT_SECTION_KEYS,
  parseSection,
} from "@/lib/achievement-sections";
import type { House, SportTrack, SportsAchievement } from "@/lib/types/database";

export function generateStaticParams() {
  return ACHIEVEMENT_SECTION_KEYS.map((section) => ({ section }));
}

export default async function AchievementSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const [{ section: rawSection }, query] = await Promise.all([params, searchParams]);
  const section = parseSection(rawSection);
  if (!section) notFound();
  const config = ACHIEVEMENT_SECTIONS[section];
  const { defaultYear, selectedYear } = resolveSelectedYear(query.year);

  const categoryColumns = config.hasCategories ? "category, track_id, sport_tracks(name)," : "";

  const supabase = await createClient();
  const { role } = await getStaffRole();
  const canEdit = role === "super";
  const [tracks, houses, sports, { data: achievements }, years] = await Promise.all([
    getSportTracks(),
    getHouses(),
    getSports(),
    supabase
      .from(config.achievementsTable)
      .select(
        `id, meet_year, sport, achievement_type, team_name, notes, created_at, ${categoryColumns}
         sports_achievement_winners:${config.winnersTable}(student_id, place, students(student_id, full_name, nic)),
         certificate_references(reference_no, issued_certificates(id, file_name, content_type))`
      )
      .eq("meet_year", selectedYear)
      .order("created_at", { ascending: false }),
    getSectionYears(supabase, section, "achievements", selectedYear, defaultYear),
  ]);

  return (
    <section>
      <AchievementsClient
        section={section}
        title={`${config.label} Achievements`}
        headerActions={
          canEdit ? <CsvImportDialog type="achievements" section={section} /> : null
        }
        achievements={(achievements ?? []) as unknown as SportsAchievement[]}
        houses={houses as House[]}
        sports={(sports ?? []).map((sport) => sport.name)}
        tracks={tracks as SportTrack[]}
        hasCategories={config.hasCategories}
        defaultYear={selectedYear}
        selectedYear={selectedYear}
        years={years}
        canEdit={canEdit}
      />
    </section>
  );
}
