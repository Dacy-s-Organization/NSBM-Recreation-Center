import { createClient } from "@/lib/supabase/server";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { StudentsClient } from "@/components/students-client";
import { getHouses } from "@/lib/data/reference";
import type { Student } from "@/lib/types/database";

export const STUDENTS_PAGE_SIZE = 50;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const from = (page - 1) * STUDENTS_PAGE_SIZE;
  const to = from + STUDENTS_PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: students, count }, houses] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, student_id, full_name, house_id, serial_no, faculty, intake, degree_programme, university, title, gender, nic, mobile, email, created_at, houses(name)",
        { count: "exact" }
      )
      .order("full_name")
      .range(from, to),
    getHouses(),
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / STUDENTS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900">Students</h2>
          <p className="mt-1 text-zinc-600">
            Search, filter, and manage students by faculty, intake, and house.
          </p>
        </div>
        <CsvImportDialog type="students" />
      </div>
      <StudentsClient
        students={(students ?? []) as unknown as Student[]}
        houses={houses}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={STUDENTS_PAGE_SIZE}
      />
    </div>
  );
}
