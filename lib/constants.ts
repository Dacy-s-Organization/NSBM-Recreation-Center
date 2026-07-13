export const HOUSE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Ruby: {
    bg: "bg-red-100 dark:bg-red-950/60",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  Citrine: {
    bg: "bg-amber-100 dark:bg-amber-950/60",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  Emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-950/60",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  Sapphire: {
    bg: "bg-blue-100 dark:bg-blue-950/60",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
};

export const DEFAULT_HOUSE_STYLE = {
  bg: "bg-zinc-100 dark:bg-zinc-800",
  text: "text-zinc-800 dark:text-zinc-200",
  border: "border-zinc-200 dark:border-zinc-700",
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
