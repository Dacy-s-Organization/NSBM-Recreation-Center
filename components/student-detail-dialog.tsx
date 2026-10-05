"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { normalizeFacultyCode } from "@/lib/faculties";
import { getStudentDetail, type StudentDetail } from "@/app/actions/certificates";
import { CertificateList } from "@/components/certificate-viewer";
import { Button } from "@/components/ui/button";

const FIELDS: { key: Exclude<keyof StudentDetail, "certificates">; label: string }[] = [
  { key: "student_id", label: "Student ID" },
  { key: "full_name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "gender", label: "Gender" },
  { key: "faculty", label: "Faculty" },
  { key: "intake", label: "Intake" },
  { key: "degree_programme", label: "Degree" },
  { key: "university", label: "University" },
  { key: "house", label: "House" },
  { key: "nic", label: "NIC" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
];

export function studentBatchHref(faculty: string | null | undefined, intake: string | null | undefined) {
  const code = normalizeFacultyCode(faculty ?? "");
  const batch = intake?.trim();
  if (!code || !batch) return null;
  return `/students?faculty=${encodeURIComponent(code)}&intake=${encodeURIComponent(batch)}`;
}

export function StudentDetailDialog({
  studentId,
  onClose,
  showBatchLink = false,
}: {
  studentId: string | null;
  onClose: () => void;
  showBatchLink?: boolean;
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStudent(null);
    getStudentDetail(studentId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setStudent(result.student);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return null;

  const batchHref = showBatchLink && student ? studentBatchHref(student.faculty, student.intake) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Student details</h3>
          <div className="flex items-center gap-2">
            {batchHref && (
              <Link
                href={batchHref}
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-white/10"
              >
                View batch
              </Link>
            )}
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {student && (
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            {FIELDS.map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-zinc-500">{field.label}</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{student[field.key] || "—"}</dd>
              </div>
            ))}
            <dt className="text-zinc-500">Certificates</dt>
            <dd>
              <CertificateList certificates={student.certificates} />
            </dd>
          </dl>
        )}
      </div>
    </div>
  );
}

export function StudentTextButton({
  studentId,
  label,
  onOpen,
}: {
  studentId: string | null | undefined;
  label: string;
  onOpen: (studentId: string) => void;
}) {
  if (!studentId) return <>{label || "—"}</>;
  return (
    <button
      type="button"
      className="text-left text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
      onClick={() => onOpen(studentId)}
    >
      {label || studentId}
    </button>
  );
}
