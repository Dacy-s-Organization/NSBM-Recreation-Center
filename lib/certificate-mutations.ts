import type { SupabaseClient } from "@supabase/supabase-js";
import { certificateContentType, CERTIFICATE_MAX_BYTES, parseReferenceInput } from "@/lib/certificates";
import type { CertificateParentColumn } from "@/lib/achievement-sections";
import { dbError } from "@/lib/errors";

type Db = SupabaseClient;

export async function settleReference(
  supabase: Db,
  column: CertificateParentColumn,
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
  if (renameError) return { error: dbError(renameError) };
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
    if (error) return dbError(error);
  }
  return null;
}

export async function removeCertificateFiles(supabase: Db, formData: FormData): Promise<string | null> {
  const ids = formData
    .getAll("remove_certificate")
    .map((value) => String(value).trim())
    .filter(Boolean);

  for (const id of ids) {
    const { error } = await supabase.rpc("remove_issued_certificate", { p_id: id });
    if (error) return dbError(error);
  }
  return null;
}
