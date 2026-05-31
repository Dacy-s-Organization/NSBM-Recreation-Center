"use client";

import { useMemo, useState, useTransition } from "react";
import { addStudent } from "@/app/actions/students";
import type { House, Student } from "@/lib/types/database";
import { HouseBadge } from "@/components/house-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export function StudentsClient({
  students,
  houses,
}: {
  students: Student[];
  houses: House[];
}) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.student_id.toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q)
    );
  }, [students, query]);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addStudent(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
        (document.getElementById("add-student-form") as HTMLFormElement)?.reset();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[200px] flex-1 max-w-md">
          <Label htmlFor="search">Search by student ID or name</Label>
          <Input
            id="search"
            placeholder="e.g. 2024001"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add student"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900">New student</h3>
          <form id="add-student-form" action={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="student_id">Student ID</Label>
              <Input id="student_id" name="student_id" required />
            </div>
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" required />
            </div>
            <div>
              <Label htmlFor="house_id">House</Label>
              <Select id="house_id" name="house_id" required defaultValue="">
                <option value="" disabled>
                  Select house
                </option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save student"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600">Student ID</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-600">House</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                    {query ? "No students match your search." : "No students yet. Add one or import from CSV."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-mono text-zinc-900">{s.student_id}</td>
                    <td className="px-4 py-3 text-zinc-900">{s.full_name}</td>
                    <td className="px-4 py-3">
                      {s.houses?.name ? (
                        <HouseBadge name={s.houses.name} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          Showing {filtered.length} of {students.length} students
        </p>
      </Card>
    </div>
  );
}
