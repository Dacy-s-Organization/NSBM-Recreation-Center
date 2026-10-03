export const ACHIEVEMENT_SECTIONS = {
  "sports-fiesta": {
    label: "Sports Fiesta",
    recordsTable: "sport_records",
    achievementsTable: "sports_achievements",
    winnersTable: "sports_achievement_winners",
    recordRefColumn: "sport_record_id",
    achievementRefColumn: "sports_achievement_id",
    yearsRpc: "achievement_years",
    hasCategories: true,
  },
  "inter-university": {
    label: "Inter University",
    recordsTable: "inter_uni_records",
    achievementsTable: "inter_uni_achievements",
    winnersTable: "inter_uni_achievement_winners",
    recordRefColumn: "inter_uni_record_id",
    achievementRefColumn: "inter_uni_achievement_id",
    yearsRpc: "inter_uni_achievement_years",
    hasCategories: false,
  },
} as const;

export type AchievementSection = keyof typeof ACHIEVEMENT_SECTIONS;

export type AchievementSectionConfig = (typeof ACHIEVEMENT_SECTIONS)[AchievementSection];

export type CertificateParentColumn =
  | AchievementSectionConfig["recordRefColumn"]
  | AchievementSectionConfig["achievementRefColumn"];

export const DEFAULT_ACHIEVEMENT_SECTION: AchievementSection = "sports-fiesta";

export const ACHIEVEMENT_SECTION_KEYS = Object.keys(ACHIEVEMENT_SECTIONS) as AchievementSection[];

export function parseSection(raw: unknown): AchievementSection | null {
  const value = String(raw ?? "").trim();
  return Object.prototype.hasOwnProperty.call(ACHIEVEMENT_SECTIONS, value)
    ? (value as AchievementSection)
    : null;
}

export function achievementsPath(section: AchievementSection, year?: number | string): string {
  const base = `/achievements/${section}`;
  return year === undefined ? base : `${base}?year=${year}`;
}

export function recordsPath(section: AchievementSection, year?: number | string): string {
  const base = `/achievements/${section}/records`;
  return year === undefined ? base : `${base}?year=${year}`;
}
