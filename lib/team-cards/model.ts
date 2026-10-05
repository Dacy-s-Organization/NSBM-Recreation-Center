export type TeamCardSection = "sports-fiesta" | "inter-university";

export type TeamCardSourceKind = "docx" | "xlsx" | "csv" | "image";

export type TeamCardRow = {
  studentId: string;
  fullName: string;
  jerseyNo: string | null;
};

export type OcrWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TeamCardExtract = {
  section: TeamCardSection | null;
  sourceKind: TeamCardSourceKind;
  rows: TeamCardRow[];
  warnings: string[];
};

export const TEAM_CARD_ACCEPT =
  ".docx,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic,.heif";

export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif";

export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const PHOTO_MAX_COUNT = 10;

const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heif",
  "image/heic",
  "image/heif-sequence",
  "image/heic-sequence",
]);

export function photoContentType(file: { type: string; name: string }): string | null {
  const type = file.type.toLowerCase();
  if (PHOTO_TYPES.has(type)) return type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return null;
}
