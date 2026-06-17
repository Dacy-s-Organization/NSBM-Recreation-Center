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
    code: "FOSM",
    name: "Faculty of Sciences & Media",
    description: "Science and media programmes",
  },
];

export const NSBM_FACULTY_CODES = NSBM_FACULTIES.map((f) => f.code);

export function getFacultyByCode(code: string): NsbmFaculty | undefined {
  return NSBM_FACULTIES.find((f) => f.code === code);
}

export function isNsbmFacultyCode(code: string): boolean {
  return NSBM_FACULTY_CODES.includes(code);
}
