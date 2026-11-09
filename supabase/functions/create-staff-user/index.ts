import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.106.2";

const allowedOrigins = new Set(["http://localhost:3000"]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, headers);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Not signed in." }, 401, headers);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const role = userData.user?.app_metadata?.role;
  if (userError || !userData.user || role !== "super") {
    return json({ error: "Only the super user can add accounts." }, 403, headers);
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "A valid email and password are required." }, 400, headers);
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const requestedRole = body.role === undefined || body.role === "" ? "mic" : body.role;
  if (requestedRole !== "mic" && requestedRole !== "super") {
    return json({ error: "Role must be mic or super." }, 400, headers);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid email is required." }, 400, headers);
  }
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return json({ error: "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, and a number." }, 400, headers);
  }

  const admin = createClient(url, serviceKey);
  // Verification mail stays off until the operator asks for it again.
  // The new account is confirmed immediately and signs in with this password.
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: requestedRole },
  });

  if (error) {
    console.error(error.message);
    const already = /already|registered|exists/i.test(error.message);
    return json(
      { error: already ? "An account with this email already exists." : "The account could not be created." },
      400,
      headers,
    );
  }

  return json({ success: true }, 200, headers);
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}
