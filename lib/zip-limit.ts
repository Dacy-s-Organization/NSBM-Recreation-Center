import { unzipSync } from "fflate";

const MAX_INFLATED_BYTES = 8 * 1024 * 1024;

type ZipFile = { name: string; size: number; originalSize: number };

/** Inflate only the entries `allow` accepts, and refuse archives that expand too far. */
export function unzipLimited(
  bytes: Uint8Array,
  allow: (name: string) => boolean
): Record<string, Uint8Array> {
  let total = 0;
  const files = unzipSync(bytes, {
    filter(file: ZipFile) {
      const name = file.name.replaceAll("\\", "/");
      if (!allow(name)) return false;
      const inflated = file.originalSize > 0 ? file.originalSize : file.size;
      total += inflated;
      if (inflated > MAX_INFLATED_BYTES || total > MAX_INFLATED_BYTES) {
        throw new Error("This file is too large to read.");
      }
      return true;
    },
  });
  const out: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    out[name.replaceAll("\\", "/")] = data;
  }
  return out;
}
