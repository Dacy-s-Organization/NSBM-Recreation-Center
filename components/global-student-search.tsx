"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { searchStudents, type StudentSearchResult } from "@/app/actions/students";
import { normalizeFacultyCode } from "@/lib/faculties";
import { HouseBadge } from "@/components/house-badge";
import {
  StudentDetailDialog,
  StudentTextButton,
  studentBatchHref,
} from "@/components/student-detail-dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LENGTH = 2;
const RESULT_LIMIT = 50;
const DELAY_MS = 300;

const headCell = "px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400";

export function GlobalStudentSearch({
  onActiveChange,
}: {
  onActiveChange?: (active: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const active = query.trim().length >= MIN_LENGTH;

  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function changeQuery(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const term = value.trim();
    const id = ++requestId.current;
    if (term.length < MIN_LENGTH) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const result = await searchStudents(term);
      if (id !== requestId.current) return;
      if ("error" in result) {
        setError(result.error);
        setResults([]);
      } else {
        setError(null);
        setResults(result.students);
      }
      setLoading(false);
    }, DELAY_MS);
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Label htmlFor="global-student-search">Search all students</Label>
        <Input
          id="global-student-search"
          type="search"
          placeholder="Student ID, name, email, NIC, mobile…"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Searches every faculty and batch.</p>
      </div>

      {active && (
        <>
          {loading && results === null && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          {results !== null && (
            <Card className="relative overflow-hidden p-0" aria-busy={loading}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className={headCell}>Student ID</th>
                      <th className={headCell}>Name</th>
                      <th className={headCell}>Faculty</th>
                      <th className={headCell}>Batch</th>
                      <th className={headCell}>House</th>
                      <th className={headCell}>
                        <span className="sr-only">Batch link</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                          {loading ? "Searching…" : "No students match."}
                        </td>
                      </tr>
                    ) : (
                      results.map((student) => {
                        const batchHref = studentBatchHref(student.faculty, student.intake);
                        return (
                          <tr
                            key={student.id}
                            className="border-b border-zinc-100 last:border-0 dark:border-white/10"
                          >
                            <td className="px-4 py-3 font-mono">
                              <StudentTextButton
                                studentId={student.student_id}
                                label={student.student_id ?? "—"}
                                onOpen={setOpenStudentId}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <StudentTextButton
                                studentId={student.student_id}
                                label={student.full_name}
                                onOpen={setOpenStudentId}
                              />
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {normalizeFacultyCode(student.faculty) || "—"}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{student.intake || "—"}</td>
                            <td className="px-4 py-3">
                              {student.houses?.name ? <HouseBadge name={student.houses.name} /> : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {batchHref ? (
                                <Link
                                  href={batchHref}
                                  className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                                >
                                  View batch
                                </Link>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                {loading
                  ? "Searching…"
                  : results.length >= RESULT_LIMIT
                    ? `Showing the first ${RESULT_LIMIT} matches. Refine the search to narrow it down.`
                    : `${results.length} match${results.length === 1 ? "" : "es"}`}
              </p>
            </Card>
          )}
        </>
      )}

      <StudentDetailDialog
        studentId={openStudentId}
        onClose={() => setOpenStudentId(null)}
        showBatchLink
      />
    </div>
  );
}
