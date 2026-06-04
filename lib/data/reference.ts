import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getHouses = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("houses").select("id, name").order("name");
  return data ?? [];
});

export const getSportTracks = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sport_tracks")
    .select("id, name, unit, lower_is_better")
    .order("name");
  return data ?? [];
});
