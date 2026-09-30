"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  type AchievementType,
} from "@/lib/constants";
import { resolveChosenSport } from "@/lib/sports";

function parseAchievementType(raw: string): AchievementType | null {
  const t = raw.trim();
  if ((ACHIEVEMENT_TYPES as readonly string[]).includes(t)) {
    return t as AchievementType;
  }
  return null;
}

async function resolveStudentUuid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIdText: string
): Promise<{ uuid: string | null } | { error: string }> {
  const sid = studentIdText.trim();
  if (!sid) return { uuid: null };
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
  const sportChoice = String(formData.get("sport") ?? "").trim();
  const newSport = String(formData.get("new_sport") ?? "");
  const achievementType = parseAchievementType(
    String(formData.get("achievement_type") ?? "")
  );
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerStudentId = String(formData.get("winner_student_id") ?? "").trim();

  if (!achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }
  if (!teamName) {
    return { error: "House (team) is required." };
  }
  if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER && !winnerStudentId) {
    return { error: "Student ID is required for Best Player." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const resolved = await resolveStudentUuid(supabase, winnerStudentId);
  if ("error" in resolved) return { error: resolved.error };
  const studentUuids = resolved.uuid ? [resolved.uuid] : [];

  const sportResult = await resolveChosenSport(supabase, sportChoice, newSport);
  if ("error" in sportResult) return { error: sportResult.error };
  const sport = sportResult.name;

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

  revalidatePath("/achievements", "page");
  return { success: true };
}

export async function updateAchievement(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const sportChoice = String(formData.get("sport") ?? "").trim();
  const newSport = String(formData.get("new_sport") ?? "");
  const achievementType = parseAchievementType(
    String(formData.get("achievement_type") ?? "")
  );
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerStudentId = String(formData.get("winner_student_id") ?? "").trim();

  if (!id || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }
  if (!teamName) {
    return { error: "House (team) is required." };
  }
  if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER && !winnerStudentId) {
    return { error: "Student ID is required for Best Player." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const resolved = await resolveStudentUuid(supabase, winnerStudentId);
  if ("error" in resolved) return { error: resolved.error };
  const studentUuids = resolved.uuid ? [resolved.uuid] : [];

  const sportResult = await resolveChosenSport(supabase, sportChoice, newSport);
  if ("error" in sportResult) return { error: sportResult.error };
  const sport = sportResult.name;

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

  revalidatePath("/achievements", "page");
  return { success: true };
}

export async function deleteAchievement(id: string) {
  if (!id?.trim()) {
    return { error: "Invalid achievement." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase.from("sports_achievements").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/achievements", "page");
  return { success: true };
}
