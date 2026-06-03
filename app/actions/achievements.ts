"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  type AchievementType,
} from "@/lib/constants";

function parseAchievementType(raw: string): AchievementType | null {
  const t = raw.trim();
  if ((ACHIEVEMENT_TYPES as readonly string[]).includes(t)) {
    return t as AchievementType;
  }
  return null;
}

async function resolveBestPlayerUuid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIdText: string
): Promise<{ uuid: string } | { error: string }> {
  const sid = studentIdText.trim();
  if (!sid) {
    return { error: "Student ID is required for Best Player." };
  }
  const { data } = await supabase
    .from("students")
    .select("id")
    .eq("student_id", sid)
    .maybeSingle();
  if (!data) {
    return { error: `Student "${sid}" not found.` };
  }
  return { uuid: data.id };
}

export async function addAchievement(formData: FormData) {
  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const sport = String(formData.get("sport") ?? "").trim();
  const achievementType = parseAchievementType(
    String(formData.get("achievement_type") ?? "")
  );
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerStudentId = String(formData.get("winner_student_id") ?? "").trim();

  if (!sport || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }
  if (!teamName) {
    return { error: "House (team) is required." };
  }

  const supabase = await createClient();
  let studentUuids: string[] = [];

  if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
    const resolved = await resolveBestPlayerUuid(supabase, winnerStudentId);
    if ("error" in resolved) return { error: resolved.error };
    studentUuids = [resolved.uuid];
  }

  const { data: achievement, error } = await supabase
    .from("sports_achievements")
    .insert({
      meet_year: meetYear,
      sport,
      achievement_type: achievementType,
      team_name: teamName,
      notes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (studentUuids.length > 0) {
    const { error: winnerError } = await supabase
      .from("sports_achievement_winners")
      .insert({
        achievement_id: achievement.id,
        student_id: studentUuids[0],
      });
    if (winnerError) return { error: winnerError.message };
  }

  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}

export async function updateAchievement(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const sport = String(formData.get("sport") ?? "").trim();
  const achievementType = parseAchievementType(
    String(formData.get("achievement_type") ?? "")
  );
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerStudentId = String(formData.get("winner_student_id") ?? "").trim();

  if (!id || !sport || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }
  if (!teamName) {
    return { error: "House (team) is required." };
  }

  const supabase = await createClient();
  let studentUuids: string[] = [];

  if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
    const resolved = await resolveBestPlayerUuid(supabase, winnerStudentId);
    if ("error" in resolved) return { error: resolved.error };
    studentUuids = [resolved.uuid];
  }

  const { error } = await supabase
    .from("sports_achievements")
    .update({
      meet_year: meetYear,
      sport,
      achievement_type: achievementType,
      team_name: teamName,
      notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase.from("sports_achievement_winners").delete().eq("achievement_id", id);

  if (studentUuids.length > 0) {
    const { error: winnerError } = await supabase
      .from("sports_achievement_winners")
      .insert({
        achievement_id: id,
        student_id: studentUuids[0],
      });
    if (winnerError) return { error: winnerError.message };
  }

  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAchievement(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid achievement." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sports_achievements").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}
