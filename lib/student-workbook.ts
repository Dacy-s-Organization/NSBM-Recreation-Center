import { isNsbmFacultyCode, normalizeFacultyCode, NSBM_FACULTIES } from "@/lib/faculties";
import {
  buildStudentFullName,
  normalizeStudentCsvRow,
  rowHasExplicitName,
  type CanonicalStudentCsvRow,
} from "@/lib/student-csv";
import { readXlsxWorkbook, type GridRow, type WorkbookSheet } from "@/lib/xlsx-workbook";

const HEADER_MARKERS = new Set([
  "student no",
  "student id",
  "student number",
  "student_id",
  "name with initials",
]);

const MERGE_FIELDS = [
  "serial_no",
  "faculty",
  "student_id",
  "degree_programme",
  "university",
  "title",
  "full_name",
  "gender",
  "nic",
  "mobile",
  "email",
  "house_name",
] as const satisfies readonly (keyof CanonicalStudentCsvRow)[];

export type StudentFileIssue = {
  sheet: string;
  line: number;
  message: string;
};

export type StudentFileRead = {
  rows: CanonicalStudentCsvRow[];
  issues: StudentFileIssue[];
  skippedSheets: string[];
};

type Sourced = {
  sheet: string;
  line: number;
  facultySheet: string;
  studentId: string;
  row: CanonicalStudentCsvRow;
  invalid?: string;
};

function isHeader(cells: string[]): boolean {
  return cells.some((cell) => HEADER_MARKERS.has(cell.trim().toLowerCase()));
}

function readCsvRows(text: string): GridRow[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: GridRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let i = 0;

  const pushField = () => {
    fields.push(field);
    field = "";
  };
  const pushRow = () => {
    if (fields.some((cell) => cell.trim().length > 0) || field.trim().length > 0) {
      pushField();
      rows.push({ line, cells: fields.map((cell) => cell.trim()) });
    }
    fields = [];
    field = "";
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"' && field.length === 0) {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      pushRow();
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || fields.length > 0) pushRow();
  return rows;
}

function rawFromRow(headers: string[], cells: string[]): Record<string, string> {
  const raw: Record<string, string> = {};
  headers.forEach((header, index) => {
    const key = header.trim();
    const value = cells[index]?.trim() ?? "";
    if (!key || !value || raw[key]) return;
    raw[key] = value;
  });
  return raw;
}

function sourceRows(sheets: WorkbookSheet[]): { sources: Sourced[]; skippedSheets: string[] } {
  const sources: Sourced[] = [];
  const skippedSheets: string[] = [];
  for (const sheet of sheets) {
    const headerIndex = sheet.rows.findIndex((row) => isHeader(row.cells));
    if (headerIndex < 0) {
      skippedSheets.push(sheet.name);
      continue;
    }
    const headers = sheet.rows[headerIndex].cells;
    const facultySheet = isNsbmFacultyCode(sheet.name) ? normalizeFacultyCode(sheet.name) : "";
    for (const grid of sheet.rows.slice(headerIndex + 1)) {
      const raw = rawFromRow(headers, grid.cells);
      if (Object.keys(raw).length === 0) continue;
      const explicitName = rowHasExplicitName(raw);
      const row = normalizeStudentCsvRow(raw);
      if (!explicitName) delete row.full_name;
      let invalid: string | undefined;
      if (facultySheet) {
        if (row.faculty && normalizeFacultyCode(row.faculty) !== facultySheet) {
          invalid = `Faculty "${row.faculty}" does not match sheet "${sheet.name}".`;
        } else if (!row.faculty) {
          row.faculty = facultySheet;
        }
      }
      sources.push({
        sheet: sheet.name,
        line: grid.line,
        facultySheet,
        studentId: row.student_id?.trim() ?? "",
        row,
        invalid,
      });
    }
  }
  return { sources, skippedSheets };
}

function fieldValues(sources: Sourced[], field: keyof CanonicalStudentCsvRow): string[] {
  const values: string[] = [];
  for (const source of sources) {
    const value = source.row[field]?.trim() ?? "";
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function mergeGroup(sources: Sourced[]): { row: CanonicalStudentCsvRow } | { message: string } {
  const facultySources = sources.filter((source) => source.facultySheet);
  const primary = facultySources.length > 0 ? facultySources : sources;
  const secondary = sources.filter((source) => !primary.includes(source));
  const row: CanonicalStudentCsvRow = {};
  const conflicts: string[] = [];
  for (const field of MERGE_FIELDS) {
    const preferred = fieldValues(primary, field);
    const values = preferred.length > 0 ? preferred : fieldValues(secondary, field);
    if (values.length > 1) {
      conflicts.push(`Conflicting ${field} (${values.map((value) => `"${value}"`).join(" vs ")}).`);
      continue;
    }
    if (values.length === 1) row[field] = values[0];
  }
  const intake = fieldValues(primary, "intake");
  const intakeValue = intake[0] ?? fieldValues(secondary, "intake")[0];
  if (intakeValue) row.intake = intakeValue;
  if (conflicts.length > 0) {
    const id = row.student_id || sources[0]?.studentId || "";
    const prefix = id ? `Student ${id}: ` : `Row ${sources[0]?.line ?? 0}: `;
    return { message: prefix + conflicts.join(" ") };
  }
  const fullName = buildStudentFullName(row);
  if (fullName) row.full_name = fullName;
  if (!row.full_name?.trim() && !row.student_id?.trim()) {
    return { message: "Missing Student ID or name." };
  }
  if (!isNsbmFacultyCode(row.faculty ?? "")) {
    return { message: "No recognised faculty." };
  }
  row.faculty = normalizeFacultyCode(row.faculty);
  return { row };
}

function finish(sheets: WorkbookSheet[]): StudentFileRead {
  const { sources, skippedSheets } = sourceRows(sheets);
  const issues: StudentFileIssue[] = [];
  const tainted = new Set<string>();
  const grouped = new Map<string, Sourced[]>();
  const withoutId: Sourced[] = [];

  for (const source of sources) {
    if (source.invalid) {
      issues.push({ sheet: source.sheet, line: source.line, message: source.invalid });
      if (source.studentId) tainted.add(source.studentId);
      continue;
    }
    if (source.studentId) {
      const group = grouped.get(source.studentId) ?? [];
      group.push(source);
      grouped.set(source.studentId, group);
    } else {
      withoutId.push(source);
    }
  }

  const rows: CanonicalStudentCsvRow[] = [];
  const accept = (source: Sourced, result: ReturnType<typeof mergeGroup>) => {
    if ("message" in result) {
      issues.push({ sheet: source.sheet, line: source.line, message: result.message });
      return;
    }
    rows.push(result.row);
  };

  for (const [studentId, group] of grouped) {
    const first = group[0];
    if (tainted.has(studentId)) {
      issues.push({
        sheet: first.sheet,
        line: first.line,
        message: `Student ${studentId}: not imported because another row in this file is invalid.`,
      });
      continue;
    }
    accept(first, mergeGroup(group));
  }
  for (const source of withoutId) accept(source, mergeGroup([source]));

  return { rows, issues, skippedSheets };
}

export function readStudentFile(fileName: string, bytes: Uint8Array): StudentFileRead {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return finish([{ name: "CSV", rows: readCsvRows(text) }]);
  }
  if (lower.endsWith(".xlsx")) return finish(readXlsxWorkbook(bytes));
  throw new Error("Upload an Excel workbook (.xlsx) or a CSV file.");
}

export function countByFaculty(rows: CanonicalStudentCsvRow[]): { faculty: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const faculty = row.faculty?.trim() || "";
    counts.set(faculty, (counts.get(faculty) ?? 0) + 1);
  }
  const order = NSBM_FACULTIES.map((faculty) => faculty.code);
  return [...counts.entries()]
    .sort((a, b) => {
      const left = order.indexOf(a[0]);
      const right = order.indexOf(b[0]);
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a[0].localeCompare(b[0]);
    })
    .map(([faculty, count]) => ({ faculty, count }));
}
