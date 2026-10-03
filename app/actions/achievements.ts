"use server";

import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  ACHIEVEMENT_TYPE_CHAMPION,
  ATHLETICS_SPORT_NAME,
  achievementTypesFor,
  type AchievementCategory,
  type AchievementType,
} from "@/lib/constants";
import { resolveChosenSport } from "@/lib/sports";
import {
  ACHIEVEMENT_SECTIONS,
  parseSection,
  type AchievementSectionConfig,
} from "@/lib/achievement-sections";
import { removeCertificateFiles, settleReference, storeCertificateFiles } from "@/app/actions/certificates";

const PLACES = ["1st", "2nd", "3rd"] as const;
const INVALID_SECTION = "Unknown achievement section.";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type WinnerRow = { student_id: string; place: string | null };

async function winnersFromForm(
  supabase: Supabase,
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

function parseAchievementType(
  raw: string,
  allowed: readonly AchievementType[]
): AchievementType | null {
  const t = raw.trim();
  if ((allowed as readonly string[]).includes(t)) {
    return t as AchievementType;
  }
  return null;
}

type AchievementFields = {
  sport: string;
  achievement_type: AchievementType;
  category?: AchievementCategory;
  track_id?: string | null;
};

async function achievementFieldsFromForm(
  supabase: Supabase,
  formData: FormData,
  config: AchievementSectionConfig
): Promise<{ fields: AchievementFields; winners: WinnerRow[] } | { error: string }> {
  const category: AchievementCategory =
    config.hasCategories && String(formData.get("category") ?? "") === "athletics"
      ? "athletics"
      : "other";
  const achievementType = parseAchievementType(
    String(formData.get("achievement_type") ?? ""),
    achievementTypesFor(category)
  );

  if (category === "athletics") {
    if (!achievementType) return { error: "Choose 1st, 2nd, or 3rd Place for an athletics achievement." };
    const trackId = String(formData.get("track_id") ?? "").trim();
    if (!trackId) return { error: "Choose the athletic event." };
    const { data: track } = await supabase.from("sport_tracks").select("id").eq("id", trackId).maybeSingle();
    if (!track) return { error: "That athletic event no longer exists." };

    const studentIdText = String(formData.get("winner_student_id") ?? "").trim();
    if (!studentIdText) return { error: "Student ID is required for an athletics achievement." };
    const resolved = await resolveStudentUuid(supabase, studentIdText);
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.uuid) return { error: "Student ID is required for an athletics achievement." };

    return {
      fields: { sport: ATHLETICS_SPORT_NAME, achievement_type: achievementType, category, track_id: trackId },
      winners: [{ student_id: resolved.uuid, place: null }],
    };
  }

  if (!achievementType) return { error: "Sport, achievement type, and year are required." };

  const winners = await winnersFromForm(supabase, formData, achievementType);
  if ("error" in winners) return { error: winners.error };

  const sportResult = await resolveChosenSport(
    supabase,
    String(formData.get("sport") ?? "").trim(),
    String(formData.get("new_sport") ?? "")
  );
  if ("error" in sportResult) return { error: sportResult.error };

  const fields: AchievementFields = { sport: sportResult.name, achievement_type: achievementType };
  if (config.hasCategories) {
    fields.category = "other";
    fields.track_id = null;
  }
  return { fields, winners: winners.rows };
}

async function resolveStudentUuid(
  supabase: Supabase,
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
  const section = parseSection(formData.get("section"));
  if (!section) return { error: INVALID_SECTION };
  const config = ACHIEVEMENT_SECTIONS[section];

  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const parsed = await achievementFieldsFromForm(supabase, formData, config);
  if ("error" in parsed) return { error: parsed.error };
  const winners = { rows: parsed.winners };

  const { data: achievement, error } = await supabase
    .from(config.achievementsTable)
    .insert({
      meet_year: meetYear,
      ...parsed.fields,
      team_name: teamName,
      notes,
    })
    .select("id")
    .single();

  if (error || !achievement) return { error: error?.message ?? "The achievement could not be saved." };

  const settled = await settleReference(
    supabase,
    config.achievementRefColumn,
    achievement.id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) {
    await supabase.from(config.achievementsTable).delete().eq("id", achievement.id);
    return { error: settled.error };
  }

  if (winners.rows.length > 0) {
    const { error: winnerError } = await supabase.from(config.winnersTable).insert(
      winners.rows.map((row) => ({
        achievement_id: achievement.id,
        student_id: row.student_id,
        place: row.place,
      }))
    );
    if (winnerError) return { error: winnerError.message };
  }

  const fileError = await storeCertificateFiles(supabase, settled.reference, formData);
  revalidatePath("/achievements", "layout");
  if (fileError) {
    return {
      error: `The achievement was saved as ${settled.reference}, but a certificate could not be stored: ${fileError}`,
    };
  }
  return { success: true };
}

export async function updateAchievement(formData: FormData) {
  const section = parseSection(formData.get("section"));
  if (!section) return { error: INVALID_SECTION };
  const config = ACHIEVEMENT_SECTIONS[section];

  const id = String(formData.get("id") ?? "").trim();
  const meetYear = parseInt(String(formData.get("meet_year") ?? ""), 10);
  const teamName = String(formData.get("team_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || Number.isNaN(meetYear)) {
    return { error: "Sport, achievement type, and year are required." };
  }

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const parsed = await achievementFieldsFromForm(supabase, formData, config);
  if ("error" in parsed) return { error: parsed.error };
  const winners = { rows: parsed.winners };

  const settled = await settleReference(
    supabase,
    config.achievementRefColumn,
    id,
    String(formData.get("reference_no") ?? "")
  );
  if ("error" in settled) return { error: settled.error };

  const { error } = await supabase
    .from(config.achievementsTable)
    .update({
      meet_year: meetYear,
      ...parsed.fields,
      team_name: teamName,
      notes,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await supabase.from(config.winnersTable).delete().eq("achievement_id", id);

  if (winners.rows.length > 0) {
    const { error: winnerError } = await supabase.from(config.winnersTable).insert(
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
  revalidatePath("/achievements", "layout");
  if (fileError) return { error: fileError };
  return { success: true };
}

export async function deleteAchievement(id: string, rawSection: string) {
  if (!id?.trim()) {
    return { error: "Invalid achievement." };
  }
  const section = parseSection(rawSection);
  if (!section) return { error: INVALID_SECTION };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;
  const { error } = await supabase
    .from(ACHIEVEMENT_SECTIONS[section].achievementsTable)
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/achievements", "layout");
  return { success: true };
}
