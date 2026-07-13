import { createClient } from "@/lib/supabase/server";

export async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase: null, user: null, error: "Not signed in." as const };
  }

  return { supabase, user, error: null };
}
