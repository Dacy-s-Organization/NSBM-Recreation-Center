/**
 * CSV import config per entity. When adding a DB column, update:
 * template columns here, validateImportRow, server insert in app/actions/import.ts,
 * and public/samples/*.csv
 */

import { ACHIEVEMENT_TYPES, ACHIEVEMENT_TYPE_BEST_PLAYER } from "@/lib/constants";

export type ImportType = "students" | "records" | "inventory" | "achievements";

export type ImportPreviewRow = Record<string, string | number | boolean> & {
  _line: number;
  _valid: boolean;
  _error?: string;
};

export const IMPORT_DESCRIPTIONS: Record<ImportType, string> = {
  students:
    "Required: full_name, house_name. Optional: student_id (leave empty if not in your file), faculty, intake, degree_programme, gender, nic, mobile, email.",
  records:
    "Columns: student_id, track_name, value, year. Students must exist before importing records.",
  inventory:
    "Columns: item_name, quantity. Existing items are updated by name.",
  achievements:
    "Required: meet_year, sport, achievement_type, team_name (house). Best Player requires winner_student_id. Types: Champion Team, Best Player.",
};

export const IMPORT_TEMPLATES: Record<
  ImportType,
  { filename: string; content: string; columns: string[] }
> = {
  students: {
    filename: "students_template.csv",
    content:
      "student_id,full_name,house_name,faculty,intake,degree_programme,gender,nic,mobile,email\n,John Doe,Ruby Adventurers,FOB,2026.1,Foundation Programme,Male,000000000V,0700000000,john@example.com\n2024002,Jane Smith,Citrine Warriors,FOB,2026.1,,Female,,0700000000,",
    columns: [
      "student_id",
      "full_name",
      "house_name",
      "faculty",
      "intake",
      "degree_programme",
      "gender",
      "nic",
      "mobile",
      "email",
    ],
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
  achievements: {
    filename: "achievements_template.csv",
    content:
      "meet_year,sport,achievement_type,team_name,winner_student_id,notes\n2026,Basketball,Champion Team,Sapphire Heroes,,\n2026,Basketball,Best Player,Ruby Adventurers,2024001,",
    columns: [
      "meet_year",
      "sport",
      "achievement_type",
      "team_name",
      "winner_student_id",
      "notes",
    ],
  },
};

const REQUIRED_COLUMNS: Record<ImportType, string[]> = {
  students: ["full_name", "house_name"],
  records: ["student_id", "track_name", "value", "year"],
  inventory: ["item_name", "quantity"],
  achievements: ["meet_year", "sport", "achievement_type", "team_name"],
};

export function downloadImportTemplate(type: ImportType) {
  const t = IMPORT_TEMPLATES[type];
  const blob = new Blob([t.content + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = t.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateImportRow(
  type: ImportType,
  row: Record<string, string>,
  line: number
): ImportPreviewRow {
  const required = REQUIRED_COLUMNS[type];
  const missing = required.filter((c) => !String(row[c] ?? "").trim());
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

  if (type === "achievements") {
    const meetYear = parseInt(row.meet_year, 10);
    if (Number.isNaN(meetYear) || meetYear < 1900 || meetYear > 2100) {
      return { ...row, _line: line, _valid: false, _error: "Invalid meet_year" };
    }
    const achievementType = row.achievement_type?.trim() ?? "";
    if (!(ACHIEVEMENT_TYPES as readonly string[]).includes(achievementType)) {
      return {
        ...row,
        _line: line,
        _valid: false,
        _error: `achievement_type must be ${ACHIEVEMENT_TYPES.join(" or ")}`,
      };
    }
    if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
      if (!String(row.winner_student_id ?? "").trim()) {
        return {
          ...row,
          _line: line,
          _valid: false,
          _error: "winner_student_id required for Best Player",
        };
      }
    }
  }

  return { ...row, _line: line, _valid: true };
}
