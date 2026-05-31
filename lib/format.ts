import type { SportTrack } from "@/lib/types/database";

export function formatRecordValue(value: number, track?: SportTrack | null): string {
  const unit = track?.unit?.trim();
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
