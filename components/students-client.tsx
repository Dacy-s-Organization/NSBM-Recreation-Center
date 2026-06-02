"use client";

import { useMemo, useState, useTransition } from "react";
import { addStudent, updateStudent } from "@/app/actions/students";
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
  const [facultyFilter, setFacultyFilter] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("");
  const [houseFilter, setHouseFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const faculties = useMemo(() => {
    const set = new Set(students.map((s) => s.faculty).filter(Boolean) as string[]);
    return [...set].sort();
  }, [students]);

  const intakes = useMemo(() => {
    const set = new Set(students.map((s) => s.intake).filter(Boolean) as string[]);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [students]);

  const filtered = useMemo(() => {
    let list = students;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.student_id.toLowerCase().includes(q) ||
          s.full_name.toLowerCase().includes(q)
      );
    }
    if (facultyFilter) {
      list = list.filter((s) => s.faculty === facultyFilter);
    }
    if (intakeFilter) {
      list = list.filter((s) => s.intake === intakeFilter);
    }
    if (houseFilter) {
      list = list.filter((s) => s.house_id === houseFilter);
    }
    return list;
  }, [students, query, facultyFilter, intakeFilter, houseFilter]);

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

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateStudent(formData);
      if (result.error) setError(result.error);
      else setEditingId(null);
    });
  }

  const hasActiveFilters = facultyFilter || intakeFilter || houseFilter;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1 max-w-md">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            placeholder="Student ID or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="faculty-filter">Faculty</Label>
          <Select
            id="faculty-filter"
            value={facultyFilter}
            onChange={(e) => setFacultyFilter(e.target.value)}
          >
            <option value="">All faculties</option>
            {faculties.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="intake-filter">Intake</Label>
          <Select
            id="intake-filter"
            value={intakeFilter}
            onChange={(e) => setIntakeFilter(e.target.value)}
          >
            <option value="">All intakes</option>
            {intakes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="house-filter">House</Label>
          <Select
            id="house-filter"
            value={houseFilter}
            onChange={(e) => setHouseFilter(e.target.value)}
          >
            <option value="">All houses</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFacultyFilter("");
              setIntakeFilter("");
              setHouseFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
        <Button
          type="button"
          className="ml-auto"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
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
            <div>
              <Label htmlFor="faculty">Faculty</Label>
              <Input id="faculty" name="faculty" placeholder="e.g. FOB" />
            </div>
            <div>
              <Label htmlFor="intake">Intake</Label>
              <Input id="intake" name="intake" placeholder="e.g. 2026.1" />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender" name="gender" defaultValue="">
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
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
                <th className="px-4 py-3 font-medium text-zinc-600">Faculty</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Intake</th>
                <th className="px-4 py-3 font-medium text-zinc-600">House</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    {query || hasActiveFilters
                      ? "No students match your search."
                      : "No students yet. Add one or import from CSV."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    {editingId === s.id ? (
                      <td colSpan={6} className="px-4 py-3">
                        <form
                          action={handleUpdate}
                          className="grid gap-3 sm:grid-cols-3 sm:items-end"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <div>
                            <Label>Student ID</Label>
                            <Input name="student_id" defaultValue={s.student_id} required />
                          </div>
                          <div>
                            <Label>Full name</Label>
                            <Input name="full_name" defaultValue={s.full_name} required />
                          </div>
                          <div>
                            <Label>House</Label>
                            <Select name="house_id" required defaultValue={s.house_id}>
                              {houses.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <Label>Faculty</Label>
                            <Input name="faculty" defaultValue={s.faculty ?? ""} />
                          </div>
                          <div>
                            <Label>Intake</Label>
                            <Input name="intake" defaultValue={s.intake ?? ""} />
                          </div>
                          <div>
                            <Label>Gender</Label>
                            <Select name="gender" defaultValue={s.gender ?? ""}>
                              <option value="">—</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </Select>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:col-span-3">
                            <Button type="submit" disabled={pending}>
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setEditingId(null);
                                setError(null);
                              }}
                            >
                              Cancel
                            </Button>
                            {error && (
                              <p className="w-full text-sm text-red-600">{error}</p>
                            )}
                          </div>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-zinc-900">{s.student_id}</td>
                        <td className="px-4 py-3 text-zinc-900">{s.full_name}</td>
                        <td className="px-4 py-3 text-zinc-700">{s.faculty || "—"}</td>
                        <td className="px-4 py-3 text-zinc-700">{s.intake || "—"}</td>
                        <td className="px-4 py-3">
                          {s.houses?.name ? (
                            <HouseBadge name={s.houses.name} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(s.id);
                              setShowForm(false);
                              setError(null);
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </>
                    )}
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
