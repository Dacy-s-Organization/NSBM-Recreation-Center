"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CERTIFICATE_MAX_BYTES,
  certificateContentType,
  parseReferenceInput,
  type CertificateImage,
  type IssuedCertificateMeta,
} from "@/lib/certificates";
import { ACHIEVEMENT_SECTIONS, type CertificateParentColumn } from "@/lib/achievement-sections";

type ParentColumn = CertificateParentColumn;

type Db = Awaited<ReturnType<typeof createClient>>;

export async function settleReference(
  supabase: Db,
  column: ParentColumn,
  entryId: string,
  rawTyped: string
): Promise<{ reference: string } | { error: string }> {
  const parsed = parseReferenceInput(rawTyped);
  if (parsed.error) return { error: parsed.error };

  const { data, error } = await supabase
    .from("certificate_references")
    .select("reference_no")
    .eq(column, entryId)
    .maybeSingle();

  if (error || !data?.reference_no) {
    return { error: "The entry was saved, but its reference number could not be read." };
  }

  if (!parsed.value || parsed.value === data.reference_no) {
    return { reference: data.reference_no };
  }

  const { error: renameError } = await supabase.rpc("rename_certificate_reference", {
    p_old: data.reference_no,
    p_new: parsed.value,
  });
  if (renameError) return { error: renameError.message };
  return { reference: parsed.value };
}

export async function storeCertificateFiles(
  supabase: Db,
  reference: string,
  formData: FormData
): Promise<string | null> {
  const files = formData
    .getAll("certificates")
    .filter((item): item is File => item instanceof File && item.size > 0);

  for (const file of files) {
    if (file.size > CERTIFICATE_MAX_BYTES) {
      return `${file.name} is larger than 4 MB.`;
    }
    const contentType = certificateContentType(file);
    if (!contentType) {
      return `${file.name} must be a jpeg, png, webp, gif, or heif image.`;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.rpc("attach_issued_certificate", {
      p_reference: reference,
      p_file_name: file.name,
      p_content_type: contentType,
      p_image_base64: bytes.toString("base64"),
    });
    if (error) return error.message;
  }
  return null;
}

export async function removeCertificateFiles(
  supabase: Db,
  formData: FormData
): Promise<string | null> {
  const ids = formData
    .getAll("remove_certificate")
    .map((value) => String(value).trim())
    .filter(Boolean);

  for (const id of ids) {
    const { error } = await supabase.rpc("remove_issued_certificate", { p_id: id });
    if (error) return error.message;
  }
  return null;
}

export async function getCertificateImage(id: string): Promise<
  { image: CertificateImage } | { error: string }
> {
  const certificateId = id.trim();
  if (!certificateId) return { error: "Certificate not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_issued_certificate", { p_id: certificateId });
  if (error) return { error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.image_base64) return { error: "Certificate not found." };
  return { image: row as CertificateImage };
}

export type StudentDetail = {
  student_id: string | null;
  full_name: string;
  title: string | null;
  gender: string | null;
  faculty: string | null;
  intake: string | null;
  degree_programme: string | null;
  university: string | null;
  house: string | null;
  nic: string | null;
  mobile: string | null;
  email: string | null;
  certificates: (IssuedCertificateMeta & { reference_no: string })[];
};

export async function getStudentDetail(
  studentId: string
): Promise<{ student: StudentDetail } | { error: string }> {
  const sid = studentId.trim();
  if (!sid) return { error: "Student not found." };

  const supabase = await createClient();
  const { data: student, error } = await supabase
    .from("students")
    .select(
      "id, student_id, full_name, title, gender, faculty, intake, degree_programme, university, nic, mobile, email, houses(name)"
    )
    .eq("student_id", sid)
    .maybeSingle();

  if (error || !student) return { error: "Student not found." };

  const sectionFilters = await Promise.all(
    Object.values(ACHIEVEMENT_SECTIONS).map(async (config) => {
      const [{ data: records }, { data: wins }] = await Promise.all([
        supabase.from(config.recordsTable).select("id").eq("student_id", student.id),
        supabase.from(config.winnersTable).select("achievement_id").eq("student_id", student.id),
      ]);
      const recordIds = (records ?? []).map((row) => row.id);
      const achievementIds = (wins ?? []).map((row) => row.achievement_id);
      return [
        recordIds.length ? `${config.recordRefColumn}.in.(${recordIds.join(",")})` : "",
        achievementIds.length ? `${config.achievementRefColumn}.in.(${achievementIds.join(",")})` : "",
      ];
    })
  );
  const filters = sectionFilters.flat().filter(Boolean);

  let certificates: StudentDetail["certificates"] = [];
  if (filters.length > 0) {
    const { data: refs } = await supabase
      .from("certificate_references")
      .select("reference_no, issued_certificates(id, file_name, content_type)")
      .or(filters.join(","));

    certificates = (refs ?? []).flatMap((ref) => {
      const files = Array.isArray(ref.issued_certificates) ? ref.issued_certificates : [];
      return files.map((file) => ({ ...file, reference_no: ref.reference_no }));
    });
  }

  const house = student.houses as { name?: string } | { name?: string }[] | null;
  const houseName = Array.isArray(house) ? house[0]?.name ?? null : house?.name ?? null;

  return {
    student: {
      student_id: student.student_id,
      full_name: student.full_name,
      title: student.title,
      gender: student.gender,
      faculty: student.faculty,
      intake: student.intake,
      degree_programme: student.degree_programme,
      university: student.university,
      house: houseName,
      nic: student.nic,
      mobile: student.mobile,
      email: student.email,
      certificates,
    },
  };
}
