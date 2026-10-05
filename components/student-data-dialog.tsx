"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importStudents } from "@/app/actions/import";
import { refreshAppData } from "@/app/actions/refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeBatchName } from "@/lib/batch-name";
import {
  downloadImportTemplate,
  IMPORT_DESCRIPTIONS,
  IMPORT_TEMPLATES,
  validateImportRow,
  type ImportPreviewRow,
} from "@/lib/import-config";
import { countByFaculty, readStudentFile, type StudentFileRead } from "@/lib/student-workbook";

function toPreview(parsed: StudentFileRead, intake: string): ImportPreviewRow[] {
  return parsed.rows.map((row, index) =>
    validateImportRow(
      "students",
      {
        serial_no: row.serial_no ?? "",
        intake: intake || row.intake || "",
        faculty: row.faculty ?? "",
        student_id: row.student_id ?? "",
        degree_programme: row.degree_programme ?? "",
        university: row.university ?? "",
        title: row.title ?? "",
        full_name: row.full_name ?? "",
        gender: row.gender ?? "",
        nic: row.nic ?? "",
        mobile: row.mobile ?? "",
        email: row.email ?? "",
        house_name: row.house_name ?? "",
      },
      index + 2
    )
  );
}

export function StudentDataDialog() {
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState("");
  const [parsed, setParsed] = useState<StudentFileRead | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const named = normalizeBatchName(batch);
  const batchName = "name" in named ? named.name : "";
  const preview = useMemo(() => (parsed ? toPreview(parsed, batchName) : []), [parsed, batchName]);
  const counts = useMemo(() => countByFaculty(parsed?.rows ?? []), [parsed]);
  const validCount = preview.filter((row) => row._valid).length;
  const template = IMPORT_TEMPLATES.students;
  const previewLabels = template.columnLabels ?? template.columns;

  function close() {
    if (pending) return;
    setOpen(false);
    setParsed(null);
    setResult(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setResult(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setParsed(readStudentFile(file.name, bytes));
    } catch (error) {
      setParsed(null);
      setResult(error instanceof Error ? error.message : "This file could not be read.");
    }
  }

  function handleImport() {
    if (!batchName) {
      setResult("error" in named ? named.error : "Enter a batch name.");
      return;
    }
    const valid = preview.filter((row) => row._valid);
    if (valid.length === 0) {
      setResult("No valid rows to import.");
      return;
    }
    startTransition(async () => {
      const importResult = await importStudents(
        valid.map((row) => ({
          serial_no: String(row.serial_no ?? ""),
          student_id: String(row.student_id ?? ""),
          full_name: String(row.full_name),
          house_name: String(row.house_name ?? ""),
          faculty: String(row.faculty ?? ""),
          intake: batchName,
          degree_programme: String(row.degree_programme ?? ""),
          university: String(row.university ?? ""),
          title: String(row.title ?? ""),
          gender: String(row.gender ?? ""),
          nic: String(row.nic ?? ""),
          mobile: String(row.mobile ?? ""),
          email: String(row.email ?? ""),
        })),
        batchName
      );
      const detail = (label: string, lines: string[]) =>
        `${label}:\n${lines.slice(0, 10).join("\n")}${lines.length > 10 ? `\n… and ${lines.length - 10} more` : ""}`;
      setResult(
        [
          `Processed: ${importResult.success}`,
          `New: ${importResult.inserted}`,
          `Filled: ${importResult.filled ?? 0}`,
          `Already complete: ${importResult.unchanged ?? 0}`,
          `Kept existing: ${importResult.kept ?? 0}`,
          importResult.skipped ? `Skipped: ${importResult.skipped}` : null,
          importResult.notices?.length ? detail("Notes", importResult.notices) : null,
          importResult.errors.length ? detail("Errors", importResult.errors) : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
      setParsed(null);
      if (importResult.success > 0) {
        await refreshAppData();
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Add data
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="add-data-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="add-data-title" className="font-medium text-zinc-900 dark:text-white">Add data</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{IMPORT_DESCRIPTIONS.students}</p>
              </div>
              <Button type="button" variant="ghost" onClick={close}>Close</Button>
            </div>

            <div className="mt-4 max-w-sm">
              <Label htmlFor="student-batch-name">Batch name</Label>
              <Input
                id="student-batch-name"
                value={batch}
                maxLength={40}
                placeholder="25.1 MOHE"
                onChange={(event) => setBatch(event.target.value)}
              />
              {"error" in named && batch.trim().length > 0 && (
                <p className="mt-1 text-xs text-red-600">{named.error}</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => downloadImportTemplate("students")}>
                Download template
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10">
                Upload file
                <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFile} />
              </label>
              {parsed && (
                <Button type="button" onClick={handleImport} disabled={pending || !batchName || validCount === 0}>
                  {pending ? "Importing…" : `Import ${validCount} row(s)`}
                </Button>
              )}
            </div>

            {parsed && (
              <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  {counts.length > 0
                    ? counts.map((item) => `${item.faculty} ${item.count}`).join(" · ")
                    : "No students recognised."}
                  {` · ${parsed.rows.length} total`}
                </p>
                {parsed.skippedSheets.length > 0 && <p>Skipped sheets: {parsed.skippedSheets.join(", ")}</p>}
                {parsed.issues.length > 0 && (
                  <pre className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {parsed.issues.slice(0, 10).map((issue) => `${issue.sheet} row ${issue.line}: ${issue.message}`).join("\n")}
                    {parsed.issues.length > 10 ? `\n… and ${parsed.issues.length - 10} more` : ""}
                  </pre>
                )}
              </div>
            )}

            {preview.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
                <p className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                  Preview: {validCount} valid, {preview.length - validCount} invalid
                  {batchName ? ` · batch ${batchName}` : ""}
                </p>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-white/10">
                      <th className="px-2 py-2">Line</th>
                      {previewLabels.map((label, index) => (
                        <th key={template.columns[index] ?? index} className="whitespace-nowrap px-2 py-2">{label}</th>
                      ))}
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((row) => (
                      <tr key={row._line} className={row._valid ? "" : "bg-red-50 dark:bg-red-950/50"}>
                        <td className="px-2 py-1">{row._line}</td>
                        {template.columns.map((column) => (
                          <td key={column} className="px-2 py-1">{row[column]}</td>
                        ))}
                        <td className="px-2 py-1">
                          {row._valid ? <span className="text-emerald-700 dark:text-emerald-400">OK</span> : <span className="text-red-600 dark:text-red-300">{row._error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">Showing first 20 of {preview.length} rows</p>}
              </div>
            )}

            {result && (
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-white/5 dark:text-zinc-300">{result}</pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
