import { createClient } from "@/lib/supabase/server";
import { RecordsClient } from "@/components/records-client";
import { AchievementsClient } from "@/components/achievements-client";
import type { SportRecord, SportsAchievement } from "@/lib/types/database";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const defaultYear = new Date().getFullYear();

  const [
    { data: records },
    { data: tracks },
    { data: achievements },
  ] = await Promise.all([
    supabase
      .from("sport_records")
      .select(
        `id, student_id, track_id, year, value, recorded_at,
         students(student_id, full_name),
         sport_tracks(name, unit, lower_is_better)`
      )
      .order("recorded_at", { ascending: false }),
    supabase
      .from("sport_tracks")
      .select("id, name, unit, lower_is_better")
      .order("name"),
    supabase
      .from("sports_achievements")
      .select(
        `id, meet_year, sport, achievement_type, team_name, notes, created_at,
         sports_achievement_winners(student_id, students(student_id, full_name))`
      )
      .order("meet_year", { ascending: false }),
  ]);

  const years = [
    ...new Set((records ?? []).map((r) => r.year as number)),
    defaultYear,
  ].sort((a, b) => b - a);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Achievements</h2>
        <p className="mt-1 text-zinc-600">
          Athletic records and sports achievements for the recreation center.
        </p>
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-800">
          Athletic Records
        </h3>
        <RecordsClient
          records={(records ?? []) as unknown as SportRecord[]}
          tracks={tracks ?? []}
          years={years}
          defaultYear={defaultYear}
        />
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-800">
          Sports Achievements
        </h3>
        <AchievementsClient
          achievements={(achievements ?? []) as unknown as SportsAchievement[]}
          defaultYear={defaultYear}
        />
      </section>
    </div>
  );
}
