"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import {
  importStudents,
  importRecords,
  importInventory,
} from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ImportType = "students" | "records" | "inventory";

const templates: Record<ImportType, { filename: string; content: string; columns: string[] }> = {
  students: {
    filename: "students_template.csv",
    content: "student_id,full_name,house_name\n2024001,John Doe,Ruby Adventurers",
    columns: ["student_id", "full_name", "house_name"],
  },
  records: {
    filename: "records_template.csv",
    content: "student_id,track_name,value,year\n2024001,Long Jump,5.42,2024",
    columns: ["student_id", "track_name", "value", "year"],
  },
  inventory: {
    filename: "inventory_template.csv",
    content: "item_name,quantity\nBasketballs,10\nBadminton Rackets,20",
    columns: ["item_name", "quantity"],
  },
};

type PreviewRow = Record<string, string | number | boolean> & {
  _line: number;
  _valid: boolean;
  _error?: string;
};

function downloadTemplate(type: ImportType) {
  const t = templates[type];
  const blob = new Blob([t.content + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = t.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function validateRow(
  type: ImportType,
  row: Record<string, string>,
  line: number
): PreviewRow {
  const cols = templates[type].columns;
  const missing = cols.filter((c) => !String(row[c] ?? "").trim());
  if (missing.length > 0) {
    return {
      ...row,
      _line: line,
      _valid: false,
      _error: `Missing: ${missing.join(", ")}`,
    };
  }
  if (type === "records") {
    const value = parseFloat(row.value);
    const year = parseInt(row.year, 10);
    if (Number.isNaN(value) || value < 0) {
      return { ...row, _line: line, _valid: false, _error: "Invalid value" };
    }
    if (Number.isNaN(year)) {
      return { ...row, _line: line, _valid: false, _error: "Invalid year" };
    }
  }
  if (type === "inventory") {
    const qty = parseInt(row.quantity, 10);
    if (Number.isNaN(qty) || qty < 0) {
      return { ...row, _line: line, _valid: false, _error: "Invalid quantity" };
    }
  }
  return { ...row, _line: line, _valid: true };
}

function ImportSection({
  type,
  title,
  description,
}: {
  type: ImportType;
  title: string;
  description: string;
}) {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const rows = parsed.data.map((row, i) =>
          validateRow(type, row, i + 2)
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
            student_id: String(r.student_id),
            full_name: String(r.full_name),
            house_name: String(r.house_name),
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
      } else {
        importResult = await importInventory(
          valid.map((r) => ({
            item_name: String(r.item_name),
            quantity: String(r.quantity),
          }))
        );
      }

      const msg = [
        `Imported: ${importResult.success}`,
        importResult.skipped ? `Skipped (duplicates): ${importResult.skipped}` : null,
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
    });
  }

  const validCount = preview.filter((r) => r._valid).length;
  const invalidCount = preview.length - validCount;

  return (
    <Card>
      <h3 className="font-medium text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => downloadTemplate(type)}>
          Download template
        </Button>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200">
          Upload CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
        {preview.length > 0 && (
          <Button type="button" onClick={handleImport} disabled={pending || validCount === 0}>
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
                {templates[type].columns.map((c) => (
                  <th key={c} className="px-2 py-2 capitalize">
                    {c.replace(/_/g, " ")}
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
                  {templates[type].columns.map((c) => (
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
    </Card>
  );
}

export function ImportClient() {
  return (
    <div className="space-y-6">
      <ImportSection
        type="students"
        title="Import students"
        description="Columns: student_id, full_name, house_name. House names must match exactly (e.g. Ruby Adventurers)."
      />
      <ImportSection
        type="records"
        title="Import sport records"
        description="Columns: student_id, track_name, value, year. Students must exist before importing records."
      />
      <ImportSection
        type="inventory"
        title="Import inventory"
        description="Columns: item_name, quantity. Existing items are updated by name."
      />
    </div>
  );
}
