export const CERTIFICATE_MAX_BYTES = 4 * 1024 * 1024;

export const CERTIFICATE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heif",
  "image/heic",
  "image/heif-sequence",
  "image/heic-sequence",
] as const;

const REFERENCE_PATTERN = /^AA\d{5}$/;

export type IssuedCertificateMeta = {
  id: string;
  file_name: string;
  content_type: string;
};

export type CertificateReference = {
  reference_no: string;
  issued_certificates?: IssuedCertificateMeta[] | null;
};

export type CertificateImage = {
  file_name: string;
  content_type: string;
  image_base64: string;
};

export function parseReferenceInput(raw: string): { value: string | null; error?: string } {
  const value = raw.trim().toUpperCase();
  if (!value) return { value: null };
  if (!REFERENCE_PATTERN.test(value)) {
    return { value: null, error: "Reference number must look like AA00001." };
  }
  return { value };
}

export function certificateOf(row: {
  certificate_references?: CertificateReference | CertificateReference[] | null;
}): CertificateReference | null {
  const linked = row.certificate_references;
  if (!linked) return null;
  return Array.isArray(linked) ? (linked[0] ?? null) : linked;
}

export function previewableCertificate(contentType: string): boolean {
  return (
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/gif"
  );
}

export function certificateContentType(file: { name: string; type: string }): string | null {
  const declared = file.type.trim().toLowerCase();
  if ((CERTIFICATE_CONTENT_TYPES as readonly string[]).includes(declared)) return declared;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heif") return "image/heif";
  if (ext === "heic") return "image/heic";
  return null;
}
