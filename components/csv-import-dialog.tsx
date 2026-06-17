"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  importStudents,
  importRecords,
  importInventory,
  importAchievements,
} from "@/app/actions/import";
import {
  type ImportType,
  type ImportPreviewRow,
  IMPORT_DESCRIPTIONS,
  IMPORT_TEMPLATES,
  downloadImportTemplate,
  validateImportRow,
} from "@/lib/import-config";
import { Button } from "@/components/ui/button";

export function CsvImportDialog({
  type,
  label = "Import CSV",
}: {
  type: ImportType;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setOpen(false);
    setPreview([]);
    setResult(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const rows = parsed.data.map((row, i) =>
          validateImportRow(type, row, i + 2)
        );
        setPreview(rows);
      },
      error: (err) => setResult(`Parse error: ${err.message}`),
    });
    e.target.value = "";
  }

  function handleImport() {
    const valid = preview.filter((r) => r._valid);
    if (valid.length === 0) {
      setResult("No valid rows to import.");
      return;
    }

    startTransition(async () => {
      let importResult;
      if (type === "students") {
        importResult = await importStudents(
          valid.map((r) => ({
            serial_no: String(r.serial_no ?? ""),
            student_id: String(r.student_id ?? ""),
            full_name: String(r.full_name),
            house_name: String(r.house_name ?? ""),
            faculty: String(r.faculty ?? ""),
            intake: String(r.intake ?? ""),
            degree_programme: String(r.degree_programme ?? ""),
            university: String(r.university ?? ""),
            title: String(r.title ?? ""),
            gender: String(r.gender ?? ""),
            nic: String(r.nic ?? ""),
            mobile: String(r.mobile ?? ""),
            email: String(r.email ?? ""),
          }))
        );
      } else if (type === "records") {
        importResult = await importRecords(
          valid.map((r) => ({
            student_id: String(r.student_id),
            track_name: String(r.track_name),
            value: String(r.value),
            year: String(r.year),
          }))
        );
      } else if (type === "inventory") {
        importResult = await importInventory(
          valid.map((r) => ({
            item_name: String(r.item_name),
            quantity: String(r.quantity),
          }))
        );
      } else {
        importResult = await importAchievements(
          valid.map((r) => ({
            meet_year: String(r.meet_year),
            sport: String(r.sport),
            achievement_type: String(r.achievement_type),
            team_name: String(r.team_name),
            winner_student_id: String(r.winner_student_id ?? ""),
            notes: String(r.notes ?? ""),
          }))
        );
      }

      const msg = [
        `Processed: ${importResult.success}`,
        importResult.inserted ? `New: ${importResult.inserted}` : null,
        importResult.updated ? `Updated: ${importResult.updated}` : null,
        importResult.skipped ? `Skipped: ${importResult.skipped}` : null,
        importResult.errors.length
          ? `Errors:\n${importResult.errors.slice(0, 10).join("\n")}${
              importResult.errors.length > 10
                ? `\n… and ${importResult.errors.length - 10} more`
                : ""
            }`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      setResult(msg);
      setPreview([]);
      if (importResult.success > 0) {
        router.refresh();
      }
    });
  }

  const validCount = preview.filter((r) => r._valid).length;
  const invalidCount = preview.length - validCount;
  const template = IMPORT_TEMPLATES[type];
  const previewLabels =
    template.columnLabels ??
    template.columns.map((c) => c.replace(/_/g, " "));

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-import-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="csv-import-title" className="font-medium text-zinc-900">
                  {label}
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {IMPORT_DESCRIPTIONS[type]}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={close}>
                Close
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => downloadImportTemplate(type)}
              >
                Download template
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
              {preview.length > 0 && (
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={pending || validCount === 0}
                >
                  {pending ? "Importing…" : `Import ${validCount} row(s)`}
                </Button>
              )}
            </div>

            {preview.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
                <p className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  Preview: {validCount} valid, {invalidCount} invalid
                </p>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="px-2 py-2">Line</th>
                      {previewLabels.map((label, i) => (
                        <th key={template.columns[i] ?? i} className="whitespace-nowrap px-2 py-2">
                          {label}
                        </th>
                      ))}
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((row) => (
                      <tr
                        key={row._line}
                        className={row._valid ? "" : "bg-red-50"}
                      >
                        <td className="px-2 py-1">{row._line}</td>
                        {template.columns.map((c) => (
                          <td key={c} className="px-2 py-1">
                            {row[c]}
                          </td>
                        ))}
                        <td className="px-2 py-1">
                          {row._valid ? (
                            <span className="text-emerald-700">OK</span>
                          ) : (
                            <span className="text-red-600">{row._error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 20 && (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    Showing first 20 of {preview.length} rows
                  </p>
                )}
              </div>
            )}

            {result && (
              <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800">
                {result}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
