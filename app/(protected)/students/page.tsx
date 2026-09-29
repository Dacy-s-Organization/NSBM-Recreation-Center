import { createClient } from "@/lib/supabase/server";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { StudentsClient } from "@/components/students-client";
import { getFacultyCards, getIntakeCards } from "@/lib/data/students-nav";
import { getHouses } from "@/lib/data/reference";
import { getFacultyByCode, isNsbmFacultyCode } from "@/lib/faculties";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import type { Student } from "@/lib/types/database";

const STUDENT_SELECT =
  "id, student_id, full_name, house_id, serial_no, faculty, intake, degree_programme, university, title, gender, nic, mobile, email, created_at, houses(name)";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ faculty?: string; intake?: string }>;
}) {
  const params = await searchParams;
  const faculty = params.faculty?.trim() ?? "";
  const intake = params.intake?.trim() ?? "";

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
        />
      </div>
    );
  }

  const { data: students } = await fetchAllPages<Student>((from, to) =>
    supabase
      .from("students")
      .select(STUDENT_SELECT)
      .eq("faculty", faculty)
      .eq("intake", intake)
      .order("full_name")
      .order("id")
      .range(from, to)
      .returns<Student[]>()
  );

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
        students={students}
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
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Students</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {intake
            ? `${facultyName ?? faculty} · Batch ${intake}`
            : faculty
              ? `Batches for ${facultyName ?? faculty}`
              : "Browse by faculty and batch, then manage student records."}
        </p>
      </div>
      <CsvImportDialog type="students" />
    </div>
  );
}
