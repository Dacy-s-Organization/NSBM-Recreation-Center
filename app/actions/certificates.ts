"use server";

import { createClient } from "@/lib/supabase/server";
import {
  type CertificateImage,
  type IssuedCertificateMeta,
} from "@/lib/certificates";
import { dbError } from "@/lib/errors";
import { ACHIEVEMENT_SECTIONS } from "@/lib/achievement-sections";

export async function getCertificateImage(id: string): Promise<
  { image: CertificateImage } | { error: string }
> {
  const certificateId = id.trim();
  if (!certificateId) return { error: "Certificate not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_issued_certificate", { p_id: certificateId });
  if (error) return { error: dbError(error) };

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
