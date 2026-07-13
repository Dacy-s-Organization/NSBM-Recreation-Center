/** NSBM Green University — four foundation faculties */

export type NsbmFaculty = {
  code: string;
  name: string;
  description: string;
};

export const NSBM_FACULTIES: NsbmFaculty[] = [
  {
    code: "FOC",
    name: "Faculty of Computing",
    description: "Computing and IT programmes",
  },
  {
    code: "FOB",
    name: "Faculty of Business",
    description: "Business and management programmes",
  },
  {
    code: "FOE",
    name: "Faculty of Engineering",
    description: "Engineering programmes",
  },
  {
    code: "FOS",
    name: "Faculty of Sciences",
    description: "Science programmes",
  },
];

/** Legacy / alternate codes → canonical NSBM codes */
const FACULTY_ALIASES: Record<string, string> = {
  FOSM: "FOS",
};

export const NSBM_FACULTY_CODES = NSBM_FACULTIES.map((f) => f.code);

export function normalizeFacultyCode(code: string | null | undefined): string {
  const trimmed = code?.trim().toUpperCase() ?? "";
  if (!trimmed) return "";
  return FACULTY_ALIASES[trimmed] ?? trimmed;
}

export function getFacultyByCode(code: string): NsbmFaculty | undefined {
  const normalized = normalizeFacultyCode(code);
  return NSBM_FACULTIES.find((f) => f.code === normalized);
}

export function isNsbmFacultyCode(code: string): boolean {
  return NSBM_FACULTY_CODES.includes(normalizeFacultyCode(code));
}
