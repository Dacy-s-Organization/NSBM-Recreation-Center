export const HOUSE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Ruby: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
  },
  Citrine: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  Emerald: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  Sapphire: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-200",
  },
};

export const DEFAULT_HOUSE_STYLE = {
  bg: "bg-zinc-100",
  text: "text-zinc-800",
  border: "border-zinc-200",
};

export const ACHIEVEMENT_TYPES = ["Champion Team", "Best Player"] as const;
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

export const ACHIEVEMENT_TYPE_CHAMPION: AchievementType = "Champion Team";
export const ACHIEVEMENT_TYPE_BEST_PLAYER: AchievementType = "Best Player";

export function formatTrackUnitLabel(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (u === "s") return "seconds";
  if (u === "m") return "meters";
  return unit.trim() || "value";
}
