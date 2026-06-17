import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { StudentsClient } from "@/components/students-client";
import { getFacultyCards, getIntakeCards } from "@/lib/data/students-nav";
import { getHouses } from "@/lib/data/reference";
import { getFacultyByCode, isNsbmFacultyCode } from "@/lib/faculties";
import type { Student } from "@/lib/types/database";

export const STUDENTS_PAGE_SIZE = 50;

const STUDENT_SELECT =
  "id, student_id, full_name, house_id, serial_no, faculty, intake, degree_programme, university, title, gender, nic, mobile, email, created_at, houses(name)";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ faculty?: string; intake?: string; page?: string }>;
}) {
  const params = await searchParams;
  const faculty = params.faculty?.trim() ?? "";
  const intake = params.intake?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  const houses = await getHouses();

  if (!faculty || !isNsbmFacultyCode(faculty)) {
    const facultyCards = await getFacultyCards(supabase);

    return (
      <div className="space-y-6">
        <StudentsPageHeader />
        <StudentsClient
          view="faculties"
          facultyCards={facultyCards}
          houses={houses}
          students={[]}
          page={1}
          totalPages={1}
          totalCount={0}
          pageSize={STUDENTS_PAGE_SIZE}
        />
      </div>
    );
  }

  const facultyInfo = getFacultyByCode(faculty)!;

  if (!intake) {
    const intakeCards = await getIntakeCards(supabase, faculty);

    return (
      <div className="space-y-6">
        <StudentsPageHeader faculty={faculty} facultyName={facultyInfo.name} />
        <StudentsClient
          view="intakes"
          facultyCards={[]}
          intakeCards={intakeCards}
          selectedFaculty={faculty}
          selectedFacultyName={facultyInfo.name}
          houses={houses}
          students={[]}
          page={1}
          totalPages={1}
          totalCount={0}
          pageSize={STUDENTS_PAGE_SIZE}
        />
      </div>
    );
  }

  const from = (page - 1) * STUDENTS_PAGE_SIZE;
  const to = from + STUDENTS_PAGE_SIZE - 1;

  const { data: students, count } = await supabase
    .from("students")
    .select(STUDENT_SELECT, { count: "exact" })
    .eq("faculty", faculty)
    .eq("intake", intake)
    .order("full_name")
    .range(from, to);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / STUDENTS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <StudentsPageHeader
        faculty={faculty}
        facultyName={facultyInfo.name}
        intake={intake}
      />
      <StudentsClient
        view="list"
        facultyCards={[]}
        intakeCards={[]}
        selectedFaculty={faculty}
        selectedFacultyName={facultyInfo.name}
        selectedIntake={intake}
        houses={houses}
        students={(students ?? []) as unknown as Student[]}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={STUDENTS_PAGE_SIZE}
      />
    </div>
  );
}

function StudentsPageHeader({
  faculty,
  facultyName,
  intake,
}: {
  faculty?: string;
  facultyName?: string;
  intake?: string;
}) {
  const backHref = intake
    ? `/students?faculty=${encodeURIComponent(faculty ?? "")}`
    : faculty
      ? "/students"
      : null;
  const backLabel = intake
    ? `Back to ${facultyName ?? faculty}`
    : "Back to faculties";

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {backHref ? (
          <BackLink href={backHref} label={backLabel} className="shrink-0" />
        ) : null}
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-zinc-900">Students</h2>
          <p className="mt-1 text-zinc-600">
            {intake
              ? `${facultyName ?? faculty} · Batch ${intake}`
              : faculty
                ? `Batches for ${facultyName ?? faculty}`
                : "Browse by faculty and batch, then manage student records."}
          </p>
        </div>
      </div>
      <CsvImportDialog type="students" />
    </div>
  );
}
