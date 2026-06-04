/**
 * Map NSBM Foundation CSV headers (and legacy app headers) to canonical student fields.
 */

export type CanonicalStudentCsvRow = {
  serial_no?: string;
  intake?: string;
  faculty?: string;
  student_id?: string;
  degree_programme?: string;
  university?: string;
  title?: string;
  full_name?: string;
  gender?: string;
  nic?: string;
  mobile?: string;
  email?: string;
  house_name?: string;
};

const HEADER_ALIASES: Record<string, keyof CanonicalStudentCsvRow> = {
  serial_no: "serial_no",
  "serial no": "serial_no",
  intake: "intake",
  faculty: "faculty",
  student_id: "student_id",
  "student no": "student_id",
  "student number": "student_id",
  degree_programme: "degree_programme",
  "degree programme": "degree_programme",
  university: "university",
  title: "title",
  full_name: "full_name",
  "full name": "full_name",
  "name with initials": "full_name",
  gender: "gender",
  nic: "nic",
  "nic/passport": "nic",
  passport: "nic",
  mobile: "mobile",
  "mobile no": "mobile",
  "mobile number": "mobile",
  email: "email",
  "e-mail": "email",
  house_name: "house_name",
  house: "house_name",
};

export function normalizePhone(value: string): string {
  return value.replace(/[,\s]/g, "").trim();
}

export function buildStudentFullName(row: CanonicalStudentCsvRow): string {
  const name = row.full_name?.trim() ?? "";
  const title = row.title?.trim() ?? "";
  if (name) {
    return title ? `${title} ${name}`.replace(/\s+/g, " ").trim() : name;
  }
  const email = row.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  const sid = row.student_id?.trim();
  if (sid) return `Student ${sid}`;
  return "";
}

export function normalizeStudentCsvRow(
  raw: Record<string, string>
): CanonicalStudentCsvRow {
  const out: CanonicalStudentCsvRow = {};

  for (const [key, value] of Object.entries(raw)) {
    const alias = HEADER_ALIASES[key.trim().toLowerCase()];
    if (alias) {
      const v = String(value ?? "").trim();
      if (v) out[alias] = v;
    }
  }

  if (out.mobile) {
    out.mobile = normalizePhone(out.mobile);
  }
  if (out.nic) {
    out.nic = out.nic.replace(/,/g, "").trim();
  }

  const fullName = buildStudentFullName(out);
  if (fullName) out.full_name = fullName;

  return out;
}

export function isNsbmFoundationCsv(headers: string[]): boolean {
  const lower = headers.map((h) => h.trim().toLowerCase());
  return lower.includes("student no") || lower.includes("name with initials");
}
