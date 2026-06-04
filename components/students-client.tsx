"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addStudent, deleteStudent, updateStudent } from "@/app/actions/students";
import type { House, Student } from "@/lib/types/database";
import {
  STUDENT_TABLE_COLUMNS,
  STUDENT_TABLE_COLUMN_COUNT,
} from "@/lib/student-columns";
import { StudentFieldsForm } from "@/components/student-fields-form";
import { HouseBadge } from "@/components/house-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

function cellValue(s: Student, key: (typeof STUDENT_TABLE_COLUMNS)[number]["key"]) {
  switch (key) {
    case "serial_no":
      return s.serial_no ?? "—";
    case "student_id":
      return s.student_id ?? "—";
    case "degree_programme":
      return s.degree_programme || "—";
    case "house":
      return s.houses?.name ? <HouseBadge name={s.houses.name} /> : "—";
    default:
      return (s[key] as string | null) || "—";
  }
}

export function StudentsClient({
  students,
  houses,
  page,
  totalPages,
  totalCount,
}: {
  students: Student[];
  houses: House[];
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
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
          (s.student_id?.toLowerCase().includes(q) ?? false) ||
          s.full_name.toLowerCase().includes(q) ||
          (s.email?.toLowerCase().includes(q) ?? false) ||
          (s.nic?.toLowerCase().includes(q) ?? false) ||
          (s.mobile?.toLowerCase().includes(q) ?? false) ||
          (s.faculty?.toLowerCase().includes(q) ?? false)
      );
    }
    if (facultyFilter) list = list.filter((s) => s.faculty === facultyFilter);
    if (intakeFilter) list = list.filter((s) => s.intake === intakeFilter);
    if (houseFilter) list = list.filter((s) => s.house_id === houseFilter);
    return list;
  }, [students, query, facultyFilter, intakeFilter, houseFilter]);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addStudent(formData);
      if (result.error) setError(result.error);
      else {
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

  function handleDelete(id: string, label: string) {
    if (
      !window.confirm(
        `Delete student ${label}? Their sport records and achievement links will also be removed.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteStudent(id);
      if (result.error) setError(result.error);
      else if (editingId === id) setEditingId(null);
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
            placeholder="Student No, name, email, NIC, mobile…"
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
          <form
            id="add-student-form"
            action={handleAdd}
            className="mt-4 grid gap-4 sm:grid-cols-3"
          >
            <StudentFieldsForm houses={houses} />
            <div className="flex gap-2 sm:col-span-3">
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
          <table className="min-w-[1400px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                {STUDENT_TABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-3 py-3 font-medium text-zinc-600"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="sticky right-0 bg-zinc-50 px-3 py-3 font-medium text-zinc-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={STUDENT_TABLE_COLUMN_COUNT}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    {query || hasActiveFilters
                      ? "No students match your search."
                      : "No students yet. Add one or import from CSV."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                    {editingId === s.id ? (
                      <td colSpan={STUDENT_TABLE_COLUMN_COUNT} className="px-4 py-3">
                        <form
                          action={handleUpdate}
                          className="grid gap-3 sm:grid-cols-3 sm:items-end"
                        >
                          <input type="hidden" name="id" value={s.id} />
                          <StudentFieldsForm student={s} houses={houses} />
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
                        {STUDENT_TABLE_COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className={`whitespace-nowrap px-3 py-2 text-zinc-700 ${
                              col.key === "student_id" ? "font-mono text-zinc-900" : ""
                            } ${col.key === "degree_programme" ? "max-w-[220px] truncate" : ""} ${
                              col.key === "email" ? "max-w-[180px] truncate" : ""
                            }`}
                            title={
                              col.key === "degree_programme"
                                ? s.degree_programme ?? undefined
                                : col.key === "email"
                                  ? s.email ?? undefined
                                  : undefined
                            }
                          >
                            {cellValue(s, col.key)}
                          </td>
                        ))}
                        <td className="sticky right-0 bg-white px-3 py-2">
                          <div className="flex flex-wrap gap-2">
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
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() =>
                                handleDelete(
                                  s.id,
                                  s.student_id ?? s.full_name
                                )
                              }
                              disabled={pending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          <p>
            Showing {filtered.length} on this page · {totalCount} total students
            {totalPages > 1 && ` (page ${page} of ${totalPages})`}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/students?page=${page - 1}`}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-zinc-100 px-3 py-1.5 text-sm text-zinc-400">
                  Previous
                </span>
              )}
              {page < totalPages ? (
                <Link
                  href={`/students?page=${page + 1}`}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-lg border border-zinc-100 px-3 py-1.5 text-sm text-zinc-400">
                  Next
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
