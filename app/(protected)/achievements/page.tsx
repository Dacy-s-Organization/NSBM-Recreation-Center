import { createClient } from "@/lib/supabase/server";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { TracksManager } from "@/components/tracks-manager";
import { RecordsClient } from "@/components/records-client";
import { AchievementsClient } from "@/components/achievements-client";
import { getHouses, getSportTracks } from "@/lib/data/reference";
import type { House, SportRecord, SportTrack, SportsAchievement } from "@/lib/types/database";

const RECORDS_LIMIT = 500;

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const defaultYear = new Date().getFullYear();
  const selectedYear = parseInt(params.year ?? String(defaultYear), 10) || defaultYear;

  const supabase = await createClient();
  const [tracks, houses, { data: records }, { data: achievements }] =
    await Promise.all([
      getSportTracks(),
      getHouses(),
      supabase
        .from("sport_records")
        .select(
          `id, student_id, track_id, year, value, recorded_at,
         students(student_id, full_name),
         sport_tracks(name, unit, lower_is_better)`
        )
        .eq("year", selectedYear)
        .order("recorded_at", { ascending: false })
        .limit(RECORDS_LIMIT),
      supabase
        .from("sports_achievements")
        .select(
          `id, meet_year, sport, achievement_type, team_name, notes, created_at,
         sports_achievement_winners(student_id, students(student_id, full_name))`
        )
        .eq("meet_year", selectedYear)
        .order("created_at", { ascending: false }),
    ]);

  const years = [
    selectedYear,
    selectedYear - 1,
    selectedYear - 2,
    defaultYear,
  ]
    .filter((y, i, arr) => arr.indexOf(y) === i)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Achievements</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Athletic records and sports achievements for the recreation center.
        </p>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Athletic Records</h3>
          <div className="flex flex-wrap gap-2">
            <TracksManager tracks={tracks as SportTrack[]} />
            <CsvImportDialog type="records" />
          </div>
        </div>
        <RecordsClient
          records={(records ?? []) as unknown as SportRecord[]}
          tracks={tracks as SportTrack[]}
          years={years}
          defaultYear={selectedYear}
          selectedYear={selectedYear}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Sports Achievements
          </h3>
          <CsvImportDialog type="achievements" />
        </div>
        <AchievementsClient
          achievements={(achievements ?? []) as unknown as SportsAchievement[]}
          houses={houses as House[]}
          defaultYear={selectedYear}
          selectedYear={selectedYear}
          years={years}
        />
      </section>
    </div>
  );
}
