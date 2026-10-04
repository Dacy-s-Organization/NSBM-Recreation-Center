import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { TracksManager } from "@/components/tracks-manager";
import { RecordsClient } from "@/components/records-client";
import { getSportTracks } from "@/lib/data/reference";
import { getSectionYears, resolveSelectedYear } from "@/lib/data/achievement-years";
import { getStaffRole } from "@/lib/supabase/auth";
import { ACHIEVEMENT_SECTIONS, parseSection } from "@/lib/achievement-sections";
import type { SportRecord, SportTrack } from "@/lib/types/database";

const RECORDS_LIMIT = 500;

export default async function AthleticRecordsPage({
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

  const supabase = await createClient();
  const { role } = await getStaffRole();
  const canEdit = role === "super";
  const [tracks, { data: records }, years] = await Promise.all([
    getSportTracks(),
    supabase
      .from(config.recordsTable)
      .select(
        `id, student_id, track_id, year, value, recorded_at,
         students(student_id, full_name, gender),
         sport_tracks(name, unit, lower_is_better),
         certificate_references(reference_no, issued_certificates(id, file_name, content_type))`
      )
      .eq("year", selectedYear)
      .order("recorded_at", { ascending: false })
      .limit(RECORDS_LIMIT),
    getSectionYears(supabase, section, "records", selectedYear, defaultYear),
  ]);

  return (
    <section>
      <RecordsClient
        section={section}
        title={`${config.label} Athletic Records`}
        headerActions={
          canEdit ? (
            <>
              <TracksManager tracks={tracks as SportTrack[]} />
              <CsvImportDialog type="records" section={section} />
            </>
          ) : null
        }
        records={(records ?? []) as unknown as SportRecord[]}
        tracks={tracks as SportTrack[]}
        years={years}
        defaultYear={selectedYear}
        selectedYear={selectedYear}
        canEdit={canEdit}
      />
    </section>
  );
}
