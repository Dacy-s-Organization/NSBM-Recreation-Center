"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAchievement(formData: FormData) {
  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const sport = String(formData.get("sport") ?? "").trim();
  const achievementType = String(formData.get("achievement_type") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerIds = String(formData.get("winner_student_ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!sport || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const supabase = await createClient();

  const studentUuids: string[] = [];
  for (const sid of winnerIds) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("student_id", sid)
      .maybeSingle();
    if (!data) {
      return { error: `Student "${sid}" not found.` };
    }
    studentUuids.push(data.id);
  }

  const { data: achievement, error } = await supabase
    .from("sports_achievements")
    .insert({ meet_year: meetYear, sport, achievement_type: achievementType, team_name: teamName, notes })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (studentUuids.length > 0) {
    const rows = studentUuids.map((sid) => ({
      achievement_id: achievement.id,
      student_id: sid,
    }));
    const { error: winnerError } = await supabase
      .from("sports_achievement_winners")
      .insert(rows);
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
  const achievementType = String(formData.get("achievement_type") ?? "").trim();
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const winnerIds = String(formData.get("winner_student_ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!id || !sport || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const supabase = await createClient();

  const studentUuids: string[] = [];
  for (const sid of winnerIds) {
    const { data } = await supabase
      .from("students")
      .select("id")
      .eq("student_id", sid)
      .maybeSingle();
    if (!data) {
      return { error: `Student "${sid}" not found.` };
    }
    studentUuids.push(data.id);
  }

  const { error } = await supabase
    .from("sports_achievements")
    .update({ meet_year: meetYear, sport, achievement_type: achievementType, team_name: teamName, notes })
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase
    .from("sports_achievement_winners")
    .delete()
    .eq("achievement_id", id);

  if (studentUuids.length > 0) {
    const rows = studentUuids.map((sid) => ({
      achievement_id: id,
      student_id: sid,
    }));
    const { error: winnerError } = await supabase
      .from("sports_achievement_winners")
      .insert(rows);
    if (winnerError) return { error: winnerError.message };
  }

  revalidatePath("/achievements");
  revalidatePath("/");
  return { success: true };
}
