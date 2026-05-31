import { createClient } from "@/lib/supabase/server";
import { StudentsClient } from "@/components/students-client";
import type { Student } from "@/lib/types/database";

export default async function StudentsPage() {
  const supabase = await createClient();

  const [{ data: students }, { data: houses }] = await Promise.all([
    supabase
      .from("students")
      .select("id, student_id, full_name, house_id, created_at, houses(name)")
      .order("student_id"),
    supabase.from("houses").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900">Students</h2>
        <p className="mt-1 text-zinc-600">
          Search by student ID and assign students to houses.
        </p>
      </div>
      <StudentsClient
        students={(students ?? []) as unknown as Student[]}
        houses={houses ?? []}
      />
    </div>
  );
}
