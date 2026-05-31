import { createClient } from "@/lib/supabase/server";
import { RecordsClient } from "@/components/records-client";
import type { SportRecord } from "@/lib/types/database";

export default async function RecordsPage() {
  const supabase = await createClient();
  const defaultYear = new Date().getFullYear();

  const [{ data: records }, { data: tracks }] = await Promise.all([
    supabase
      .from("sport_records")
      .select(
        `id, student_id, track_id, year, value, recorded_at,
         students(student_id, full_name),
         sport_tracks(name, unit, lower_is_better)`
      )
      .order("recorded_at", { ascending: false }),
    supabase.from("sport_tracks").select("id, name, unit, lower_is_better").order("name"),
  ]);

  const years = [
    ...new Set((records ?? []).map((r) => r.year as number)),
    defaultYear,
  ].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Sport records</h2>
        <p className="mt-1 text-zinc-600">
          View athletic records by year and track. Add new results linked to a student ID.
        </p>
      </div>
      <RecordsClient
        records={(records ?? []) as unknown as SportRecord[]}
        tracks={tracks ?? []}
        years={years}
        defaultYear={defaultYear}
      />
    </div>
  );
}
