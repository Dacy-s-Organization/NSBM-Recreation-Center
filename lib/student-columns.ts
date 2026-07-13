/** NSBM Foundation CSV columns + recreation house column */

export const STUDENT_TABLE_COLUMNS = [
  { key: "serial_no", label: "Serial No" },
  { key: "intake", label: "Intake" },
  { key: "faculty", label: "Faculty" },
  { key: "student_id", label: "Student ID" },
  { key: "degree_programme", label: "Degree Programme" },
  { key: "university", label: "University" },
  { key: "title", label: "Title" },
  { key: "full_name", label: "Name with Initials" },
  { key: "gender", label: "Gender" },
  { key: "nic", label: "NIC/Passport" },
  { key: "mobile", label: "Mobile No" },
  { key: "email", label: "E-Mail" },
  { key: "house", label: "House" },
] as const;

export const STUDENT_TABLE_COLUMN_COUNT = STUDENT_TABLE_COLUMNS.length + 1; // + Actions

/** Columns that truncate with click-to-view when text is long (keep single-line in table) */
export const STUDENT_LONG_TEXT_COLUMN_KEYS = new Set<
  (typeof STUDENT_TABLE_COLUMNS)[number]["key"]
>(["degree_programme"]);

/** Columns redundant when browsing a specific faculty + batch */
export const STUDENT_CONTEXT_COLUMN_KEYS = new Set<
  (typeof STUDENT_TABLE_COLUMNS)[number]["key"]
>(["intake", "faculty"]);
