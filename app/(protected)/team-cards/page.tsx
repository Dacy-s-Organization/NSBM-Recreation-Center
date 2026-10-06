import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/supabase/auth";
import { TeamCardsClient, type TeamCardListItem } from "@/components/team-cards-client";

export default async function TeamCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ card?: string; section?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const { role } = await getStaffRole();
  const canEdit = role === "super";

  const [{ data: cards }, { data: fiestaLinks }, { data: interLinks }] = await Promise.all([
    supabase
      .from("team_cards")
      .select(
        "id, section, event_name, created_at, team_card_members(id, position, student_id, full_name, jersey_no), team_card_photos(id, file_name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("sports_achievements").select("team_card_id").not("team_card_id", "is", null),
    supabase.from("inter_uni_achievements").select("team_card_id").not("team_card_id", "is", null),
  ]);

  const links = new Map<string, number>();
  for (const row of [...(fiestaLinks ?? []), ...(interLinks ?? [])]) {
    const id = row.team_card_id as string | null;
    if (!id) continue;
    links.set(id, (links.get(id) ?? 0) + 1);
  }

  const items = ((cards ?? []) as TeamCardListItem[]).map((card) => ({
    ...card,
    team_card_members: [...(card.team_card_members ?? [])].sort((a, b) => a.position - b.position),
    team_card_photos: card.team_card_photos ?? [],
    linkedCount: links.get(card.id) ?? 0,
  }));

  return (
    <TeamCardsClient
      cards={items}
      canEdit={canEdit}
      initialCardId={query.card ?? null}
      initialSection={query.section ?? null}
    />
  );
}
