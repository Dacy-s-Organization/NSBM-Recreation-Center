"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addStudent, deleteStudent, updateStudent } from "@/app/actions/students";
import type { FacultyCard, IntakeCard } from "@/lib/data/students-nav";
import type { House, Student } from "@/lib/types/database";
import {
  STUDENT_CONTEXT_COLUMN_KEYS,
  STUDENT_LONG_TEXT_COLUMN_KEYS,
  STUDENT_TABLE_COLUMNS,
} from "@/lib/student-columns";
import { ExpandableCell } from "@/components/expandable-cell";
import { StudentFieldsForm } from "@/components/student-fields-form";
import { GlobalStudentSearch } from "@/components/global-student-search";
import { HouseBadge } from "@/components/house-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { blankCell, csvFileSlug, downloadCsv, toCsv } from "@/lib/csv";

type StudentsView = "faculties" | "intakes" | "list";
type StudentColumn = (typeof STUDENT_TABLE_COLUMNS)[number];

function visibleColumns(hideContext: boolean): StudentColumn[] {
  if (!hideContext) return [...STUDENT_TABLE_COLUMNS];
  return STUDENT_TABLE_COLUMNS.filter((col) => !STUDENT_CONTEXT_COLUMN_KEYS.has(col.key));
}

function cellText(s: Student, key: StudentColumn["key"]) {
  switch (key) {
    case "serial_no":
      return s.serial_no != null ? String(s.serial_no) : "—";
    case "student_id":
      return s.student_id ?? "—";
    case "degree_programme":
      return s.degree_programme || "—";
    case "house":
      return s.houses?.name ?? "—";
    default:
      return (s[key] as string | null) || "—";
  }
}

function renderCell(s: Student, col: StudentColumn) {
  if (col.key === "house") {
    return s.houses?.name ? <HouseBadge name={s.houses.name} /> : "—";
  }

  const text = cellText(s, col.key);

  if (STUDENT_LONG_TEXT_COLUMN_KEYS.has(col.key)) {
    return (
      <ExpandableCell
        label={col.label}
        value={text}
        maxWidthClass="max-w-[320px]"
      />
    );
  }

  return text;
}

function columnHeaderClass(key: StudentColumn["key"]) {
  if (key === "degree_programme") return "min-w-[240px]";
  if (key === "full_name") return "min-w-[180px]";
  if (key === "email") return "min-w-[220px]";
  if (key === "nic") return "min-w-[120px]";
  return "";
}

function columnCellClass(key: StudentColumn["key"]) {
  const base = "whitespace-nowrap px-4 py-2.5 align-middle text-zinc-700 dark:text-zinc-300";
  if (key === "full_name") return `${base} font-medium text-zinc-900 dark:text-white`;
  if (key === "email") return `${base} text-zinc-600 dark:text-zinc-400`;
  return base;
}

function StudentsBreadcrumb({
  faculty,
  facultyName,
  intake,
}: {
  faculty?: string;
  facultyName?: string;
  intake?: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <Link href="/students" className="font-medium text-emerald-800 hover:underline dark:text-emerald-400">
        All faculties
      </Link>
      {faculty && (
        <>
          <span aria-hidden>/</span>
          {intake ? (
            <Link
              href={`/students?faculty=${encodeURIComponent(faculty)}`}
              className="font-medium text-emerald-800 hover:underline dark:text-emerald-400"
            >
              {facultyName ?? faculty}
            </Link>
          ) : (
            <span className="font-medium text-zinc-900 dark:text-white">{facultyName ?? faculty}</span>
          )}
        </>
      )}
      {intake && (
        <>
          <span aria-hidden>/</span>
          <span className="font-medium text-zinc-900 dark:text-white">Batch {intake}</span>
        </>
      )}
    </nav>
  );
}

function FacultyGrid({ cards }: { cards: FacultyCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((faculty) => (
        <Link
          key={faculty.code}
          href={`/students?faculty=${encodeURIComponent(faculty.code)}`}
          className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-none dark:hover:border-emerald-400/40"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300">
              {faculty.code}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {faculty.count} student{faculty.count === 1 ? "" : "s"}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-zinc-900 group-hover:text-emerald-900 dark:text-white dark:group-hover:text-emerald-400">
            {faculty.name}
          </h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{faculty.description}</p>
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">View batches →</p>
        </Link>
      ))}
    </div>
  );
}

function IntakeGrid({
  faculty,
  cards,
}: {
  faculty: string;
  cards: IntakeCard[];
}) {
  if (cards.length === 0) {
    return (
      <Card className="p-8 text-center text-zinc-500 dark:text-zinc-400">
        No batches found for this faculty yet. Import students from CSV or add them manually.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((batch) => (
        <Link
          key={batch.intake}
          href={`/students?faculty=${encodeURIComponent(faculty)}&intake=${encodeURIComponent(batch.intake)}`}
          className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-none dark:hover:border-emerald-400/40"
        >
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Batch / Intake</p>
          <h3 className="mt-2 text-2xl font-semibold text-zinc-900 group-hover:text-emerald-900 dark:text-white dark:group-hover:text-emerald-400">
            {batch.intake}
          </h3>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {batch.count} student{batch.count === 1 ? "" : "s"}
          </p>
          <p className="mt-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">View students →</p>
        </Link>
      ))}
    </div>
  );
}

export function StudentsClient({
  view,
  facultyCards,
  intakeCards = [],
  selectedFaculty,
  selectedFacultyName,
  selectedIntake,
  students,
  houses,
  canEdit,
}: {
  view: StudentsView;
  facultyCards: FacultyCard[];
  intakeCards?: IntakeCard[];
  selectedFaculty?: string;
  selectedFacultyName?: string;
  selectedIntake?: string;
  students: Student[];
  houses: House[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [houseFilter, setHouseFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const columns = useMemo(
    () => visibleColumns(Boolean(selectedFaculty && selectedIntake)),
    [selectedFaculty, selectedIntake]
  );
  const columnCount = columns.length + (canEdit ? 1 : 0);

  const editingStudent = editingId
    ? students.find((s) => s.id === editingId)
    : undefined;

  const deletingStudent = deletingId
    ? students.find((s) => s.id === deletingId)
    : undefined;
  const modalOpen = Boolean(editingId || deletingId);

  function closeEdit() {
    setEditingId(null);
    setError(null);
  }

  function closeDelete() {
    if (pending) return;
    setDeletingId(null);
    setError(null);
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setDeletingId(null);
        setError(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalOpen]);

  const filtered = useMemo(() => {
    if (view !== "list") return students;

    let list = students;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          (s.student_id?.toLowerCase().includes(q) ?? false) ||
          s.full_name.toLowerCase().includes(q) ||
          (s.email?.toLowerCase().includes(q) ?? false) ||
          (s.nic?.toLowerCase().includes(q) ?? false) ||
          (s.mobile?.toLowerCase().includes(q) ?? false)
      );
    }
    if (houseFilter) list = list.filter((s) => s.house_id === houseFilter);
    if (genderFilter) {
      list = list.filter((s) => s.gender?.trim().toLowerCase() === genderFilter);
    }
    return list;
  }, [students, query, houseFilter, genderFilter, view]);

  function handleAdd(formData: FormData) {
    setError(null);
    if (selectedFaculty) formData.set("faculty", selectedFaculty);
    if (selectedIntake) formData.set("intake", selectedIntake);

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

  function confirmDelete() {
    if (!deletingId) return;
    const id = deletingId;
    setError(null);
    startTransition(async () => {
      const result = await deleteStudent(id);
      if (result.error) setError(result.error);
      else setDeletingId(null);
    });
  }

  if (view === "faculties") {
    return (
      <div className="space-y-4">
        <GlobalStudentSearch onActiveChange={setSearchActive} />
        {!searchActive && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Select a faculty to view batches and students.</p>
            <FacultyGrid cards={facultyCards} />
          </>
        )}
      </div>
    );
  }

  if (view === "intakes" && selectedFaculty) {
    return (
      <div className="space-y-4">
        <StudentsBreadcrumb
          faculty={selectedFaculty}
          facultyName={selectedFacultyName}
        />
        <GlobalStudentSearch onActiveChange={setSearchActive} />
        {!searchActive && (
          <>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Select a batch for <span className="font-medium">{selectedFacultyName}</span>.
            </p>
            <IntakeGrid faculty={selectedFaculty} cards={intakeCards} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StudentsBreadcrumb
        faculty={selectedFaculty}
        facultyName={selectedFacultyName}
        intake={selectedIntake}
      />

      <div className="space-y-1">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1 max-w-md">
            <Label htmlFor="search">Search students</Label>
            <Input
              id="search"
              placeholder="Student ID, name, email, NIC, mobile…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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
          <div>
            <Label htmlFor="gender-filter">Gender</Label>
            <Select
              id="gender-filter"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>
          {(houseFilter || genderFilter) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setHouseFilter("");
                setGenderFilter("");
              }}
            >
              Clear filters
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={() => {
              const houseName = houses.find((house) => house.id === houseFilter)?.name ?? "";
              downloadCsv(
                `students-${csvFileSlug(selectedIntake || "all")}-${csvFileSlug(houseName || "all-houses")}-${csvFileSlug(genderFilter || "all-genders")}.csv`,
                toCsv(
                  STUDENT_TABLE_COLUMNS.map((column) => column.label),
                  filtered.map((student) =>
                    STUDENT_TABLE_COLUMNS.map((column) => blankCell(cellText(student, column.key)))
                  )
                )
              );
            }}
          >
            Export
          </Button>
          {canEdit && (
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
          )}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Filters all {students.length} students in this batch.
        </p>
      </div>

      {error && !modalOpen && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {canEdit && showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900 dark:text-white">
            New student — {selectedFacultyName}, batch {selectedIntake}
          </h3>
          <form
            id="add-student-form"
            action={handleAdd}
            className="mt-4 grid gap-4 sm:grid-cols-3"
          >
            <StudentFieldsForm
              houses={houses}
              defaults={{ faculty: selectedFaculty, intake: selectedIntake }}
            />
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save student"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
        </Card>
      )}

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="max-h-[calc(100vh-16rem)] overflow-auto">
          <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[var(--app-surface-2)]">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${columnHeaderClass(col.key)}`}
                  >
                    {col.label}
                  </th>
                ))}
                {canEdit && (
                  <th className="sticky right-0 z-10 whitespace-nowrap bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)] dark:bg-[var(--app-surface-2)] dark:text-zinc-400 dark:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.4)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {query || houseFilter || genderFilter
                      ? "No students match your search."
                      : "No students in this batch yet. Add one or import from CSV."}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="group transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-500/10"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`${columnCellClass(col.key)} ${
                          col.key === "student_id" ? "font-mono text-zinc-900 dark:text-white" : ""
                        }`}
                      >
                        {renderCell(s, col)}
                      </td>
                    ))}
                    {canEdit && (
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white px-4 py-2.5 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)] group-hover:bg-[color-mix(in_srgb,var(--color-emerald-50)_40%,white)] dark:bg-[var(--app-surface)] dark:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.4)] dark:group-hover:bg-[color-mix(in_srgb,var(--color-emerald-500)_10%,var(--app-surface))]">
                      <div className="flex flex-nowrap items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2.5 py-1 text-xs"
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
                          variant="ghost"
                          className="h-8 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                          onClick={() => {
                            setDeletingId(s.id);
                            setError(null);
                          }}
                          disabled={pending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
          <p>
            Showing {filtered.length} of {students.length} students
          </p>
        </div>
      </Card>

      {canEdit && editingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-student-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <h3 id="edit-student-title" className="font-medium text-zinc-900 dark:text-white">
                Edit student — {editingStudent.student_id ?? editingStudent.full_name}
              </h3>
              <Button type="button" variant="ghost" onClick={closeEdit}>
                Close
              </Button>
            </div>
            <form
              key={editingStudent.id}
              action={handleUpdate}
              className="mt-4 grid gap-4 sm:grid-cols-3"
            >
              <input type="hidden" name="id" value={editingStudent.id} />
              <StudentFieldsForm student={editingStudent} houses={houses} />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-300 sm:col-span-3">{error}</p>
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canEdit && deletingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-student-title"
          aria-describedby="delete-student-description"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDelete();
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40">
            <h3 id="delete-student-title" className="font-medium text-zinc-900 dark:text-white">
              Delete student?
            </h3>
            <p
              id="delete-student-description"
              className="mt-2 text-sm text-zinc-600 dark:text-zinc-400"
            >
              <span className="font-medium text-zinc-900 dark:text-white">
                {deletingStudent.full_name}
              </span>
              {deletingStudent.student_id && ` (${deletingStudent.student_id})`} will be
              permanently removed, along with their sport records and achievement links. This
              cannot be undone.
            </p>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeDelete} disabled={pending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDelete}
                disabled={pending}
                autoFocus
              >
                {pending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
