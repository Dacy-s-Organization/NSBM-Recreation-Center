"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  ACHIEVEMENT_TYPE_CHAMPION,
  type AchievementType,
} from "@/lib/constants";
import { resolveChosenSport } from "@/lib/sports";
import { removeCertificateFiles, settleReference, storeCertificateFiles } from "@/app/actions/certificates";

const PLACES = ["1st", "2nd", "3rd"] as const;

type WinnerRow = { student_id: string; place: string | null };

async function winnersFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  achievementType: AchievementType
): Promise<{ rows: WinnerRow[] } | { error: string }> {
  if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
    const studentIdText = String(formData.get("winner_student_id") ?? "").trim();
    if (!studentIdText) return { error: "Student ID is required for Best Player." };
    const resolved = await resolveStudentUuid(supabase, studentIdText);
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.uuid) return { error: "Student ID is required for Best Player." };
    return { rows: [{ student_id: resolved.uuid, place: null }] };
  }

  if (achievementType !== ACHIEVEMENT_TYPE_CHAMPION) {
    const studentIdText = String(formData.get("winner_student_id") ?? "").trim();
    const resolved = await resolveStudentUuid(supabase, studentIdText);
    if ("error" in resolved) return { error: resolved.error };
    return { rows: resolved.uuid ? [{ student_id: resolved.uuid, place: null }] : [] };
  }

  const places = formData.getAll("place").map((value) => String(value).trim());
  const studentIds = formData.getAll("place_student_id").map((value) => String(value).trim());
  const rows: WinnerRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < Math.max(places.length, studentIds.length); i++) {
    const studentIdText = studentIds[i] ?? "";
    const place = places[i] ?? "";
    if (!studentIdText) continue;
    if (!(PLACES as readonly string[]).includes(place)) {
      return { error: "Each champion place must be 1st, 2nd, or 3rd." };
    }
    const resolved = await resolveStudentUuid(supabase, studentIdText);
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.uuid) continue;
    if (seen.has(resolved.uuid)) {
      return { error: `Student ${studentIdText} is listed more than once.` };
    }
    seen.add(resolved.uuid);
    rows.push({ student_id: resolved.uuid, place });
  }

  return { rows };
}

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

  if (!achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const winners = await winnersFromForm(supabase, formData, achievementType);
  if ("error" in winners) return { error: winners.error };

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

  if (error || !achievement) return { error: error?.message ?? "The achievement could not be saved." };

  const settled = await settleReference(
    supabase,
    "sports_achievement_id",
    achievement.id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) {
    await supabase.from("sports_achievements").delete().eq("id", achievement.id);
    return { error: settled.error };
  }

  if (winners.rows.length > 0) {
    const { error: winnerError } = await supabase.from("sports_achievement_winners").insert(
      winners.rows.map((row) => ({
        achievement_id: achievement.id,
        student_id: row.student_id,
        place: row.place,
      }))
    );
    if (winnerError) return { error: winnerError.message };
  }

  const fileError = await storeCertificateFiles(supabase, settled.reference, formData);
  revalidatePath("/achievements", "page");
  if (fileError) {
    return {
      error: `The achievement was saved as ${settled.reference}, but a certificate could not be stored: ${fileError}`,
    };
  }
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

  if (!id || !achievementType || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const winners = await winnersFromForm(supabase, formData, achievementType);
  if ("error" in winners) return { error: winners.error };

  const settled = await settleReference(
    supabase,
    "sports_achievement_id",
    id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) return { error: settled.error };

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

  if (winners.rows.length > 0) {
    const { error: winnerError } = await supabase.from("sports_achievement_winners").insert(
      winners.rows.map((row) => ({
        achievement_id: id,
        student_id: row.student_id,
        place: row.place,
      }))
    );
    if (winnerError) return { error: winnerError.message };
  }

  const removeError = await removeCertificateFiles(supabase, formData);
  if (removeError) return { error: removeError };
  const fileError = await storeCertificateFiles(supabase, settled.reference, formData);
  revalidatePath("/achievements", "page");
  if (fileError) return { error: fileError };
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
