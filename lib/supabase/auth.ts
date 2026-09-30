import { createClient } from "@/lib/supabase/server";

export const READ_ONLY_MESSAGE = "You can view data but cannot change it.";

export function roleFromAccessToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      app_metadata?: { role?: unknown };
    };
    const role = json.app_metadata?.role;
    return typeof role === "string" ? role : null;
  } catch {
    return null;
  }
}

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

/** Role from the current access token, which is what Row Level Security checks. */
export async function getStaffRole() {
  const auth = await getAuthedClient();
  if (auth.error || !auth.supabase || !auth.user) {
    return { supabase: auth.supabase, user: null, role: null as string | null };
  }

  const {
    data: { session },
  } = await auth.supabase.auth.getSession();

  return {
    supabase: auth.supabase,
    user: auth.user,
    role: roleFromAccessToken(session?.access_token),
  };
}

export async function requireSuper() {
  const auth = await getStaffRole();
  if (!auth.user || !auth.supabase) {
    return { supabase: null, user: null, error: "Not signed in." as const };
  }
  if (auth.role !== "super") {
    return { supabase: null, user: auth.user, error: READ_ONLY_MESSAGE };
  }
  return { supabase: auth.supabase, user: auth.user, error: null as string | null };
}
