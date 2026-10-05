"use server";

import { revalidatePath } from "next/cache";
import { PHOTO_MAX_BYTES, photoContentType, type TeamCardSection } from "@/lib/team-cards/model";
import { requireSuper } from "@/lib/supabase/auth";

type MemberInput = { student_id: string; full_name: string; jersey_no: string | null };

function parseSection(value: FormDataEntryValue | null): TeamCardSection | null {
  const section = String(value ?? "");
  return section === "sports-fiesta" || section === "inter-university" ? section : null;
}

function parseMembers(raw: FormDataEntryValue | null): { members: MemberInput[] } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw ?? ""));
  } catch {
    return { error: "Add at least one athlete." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: "Add at least one athlete." };

  const members: MemberInput[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { error: "Every row needs a student ID and a name." };
    const record = item as { studentId?: unknown; fullName?: unknown; jerseyNo?: unknown };
    const studentId = String(record.studentId ?? "").trim();
    const fullName = String(record.fullName ?? "").replace(/\s+/g, " ").trim();
    const jersey = String(record.jerseyNo ?? "").trim();
    if (!studentId || !fullName) return { error: "Every row needs a student ID and a name." };
    if (seen.has(studentId)) return { error: `Student ID ${studentId} is listed more than once.` };
    seen.add(studentId);
    members.push({ student_id: studentId, full_name: fullName, jersey_no: jersey || null });
  }
  return { members };
}

export async function addTeamCard(formData: FormData) {
  const eventName = String(formData.get("event_name") ?? "").trim();
  const section = parseSection(formData.get("section"));
  const sourceKind = String(formData.get("source_kind") ?? "");
  const sourceFileName = String(formData.get("source_file_name") ?? "").trim() || null;
  const parsed = parseMembers(formData.get("members"));

  if (!eventName) return { error: "Event name is required." };
  if (!section) return { error: "Choose Sports Fiesta or Inter University." };
  if (!["docx", "xlsx", "csv", "image"].includes(sourceKind)) return { error: "The team card file could not be read." };
  if ("error" in parsed) return { error: parsed.error };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const supabase = gate.supabase;

  const { data, error } = await supabase
    .from("team_cards")
    .insert({
      section,
      event_name: eventName,
      source_kind: sourceKind,
      source_file_name: sourceFileName,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "The team card could not be saved." };

  const { error: memberError } = await supabase.from("team_card_members").insert(
    parsed.members.map((member, position) => ({
      team_card_id: data.id,
      position,
      ...member,
    }))
  );
  if (memberError) {
    await supabase.from("team_cards").delete().eq("id", data.id);
    return { error: memberError.message };
  }

  revalidatePath("/team-cards");
  return { success: true as const, id: data.id as string };
}

export async function updateTeamCard(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const eventName = String(formData.get("event_name") ?? "").trim();
  const parsed = parseMembers(formData.get("members"));
  if (!id) return { error: "Team card was not found." };
  if (!eventName) return { error: "Event name is required." };
  if ("error" in parsed) return { error: parsed.error };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const { error } = await gate.supabase.rpc("replace_team_card_members", {
    p_card: id,
    p_event_name: eventName,
    p_members: parsed.members,
  });
  if (error) return { error: error.message };
  revalidatePath("/team-cards");
  return { success: true as const };
}

export async function deleteTeamCard(id: string) {
  if (!id?.trim()) return { error: "Team card was not found." };
  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const { error } = await gate.supabase.from("team_cards").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/team-cards");
  revalidatePath("/achievements", "layout");
  return { success: true as const };
}

export async function addTeamCardPhoto(formData: FormData) {
  const cardId = String(formData.get("team_card_id") ?? "").trim();
  const file = formData.get("file");
  if (!cardId) return { error: "Team card was not found." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > PHOTO_MAX_BYTES) return { error: "Each photo must be 4 MB or smaller." };
  const contentType = photoContentType(file);
  if (!contentType) return { error: "Photo must be a jpeg, png, webp, gif, or heif image." };

  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await gate.supabase.rpc("add_team_card_photo", {
    p_card: cardId,
    p_file_name: file.name,
    p_content_type: contentType,
    p_image_base64: bytes.toString("base64"),
  });
  if (error) {
    return { error: error.message.includes("at most 10") ? "A team card can have at most 10 photos." : error.message };
  }
  revalidatePath("/team-cards");
  return { success: true as const };
}

export async function deleteTeamCardPhoto(id: string) {
  if (!id?.trim()) return { error: "Photo was not found." };
  const gate = await requireSuper();
  if (gate.error || !gate.supabase) return { error: gate.error ?? "You can view data but cannot change it." };
  const { error } = await gate.supabase.from("team_card_photos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/team-cards");
  return { success: true as const };
}
