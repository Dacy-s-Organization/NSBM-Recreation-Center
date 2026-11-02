import { NextResponse } from "next/server";
import { getAuthedClient } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await getAuthedClient();
  if (!auth.user || !auth.supabase) return new NextResponse("Not signed in.", { status: 401 });

  const { data, error } = await auth.supabase.rpc("get_team_card_photo", { p_id: id });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row?.image_base64) return new NextResponse("Photo was not found.", { status: 404 });

  const bytes = Buffer.from(row.image_base64, "base64");
  const fileName = String(row.file_name ?? "photo").replace(/[^\w. -]+/g, "").replace(/^\.+/, "") || "photo";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": row.content_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
