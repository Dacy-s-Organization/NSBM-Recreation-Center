import { redirect } from "next/navigation";
import { DEFAULT_ACHIEVEMENT_SECTION, achievementsPath } from "@/lib/achievement-sections";

export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  redirect(achievementsPath(DEFAULT_ACHIEVEMENT_SECTION, year));
}
