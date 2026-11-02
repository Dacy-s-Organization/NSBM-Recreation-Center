import { NextResponse } from "next/server";
import { getStaffRole } from "@/lib/supabase/auth";
import { extractOffice, sourceKindFor } from "@/lib/team-cards/office";
import { extractOcrPasses } from "@/lib/team-cards/rows";
import { recognizeWindowsImage } from "@/lib/team-cards/windows-ocr";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await getStaffRole();
  if (!auth.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (auth.role !== "super") {
    return NextResponse.json({ error: "You can view data but cannot change it." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a team card file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Team card files must be 2 MB or smaller." }, { status: 400 });
  }
  const kind = sourceKindFor(file.name);
  if (!kind) {
    return NextResponse.json({ error: "Use a Word, Excel, CSV, or image team card." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (kind === "image") {
      const passes = await recognizeWindowsImage(file.name, bytes);
      const parsed = extractOcrPasses(passes);
      return NextResponse.json(parsed);
    }
    return NextResponse.json(extractOffice(file.name, bytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = /too large|readable|Word, Excel|smaller|Windows could not|took too long|only available/i.test(message)
      ? message
      : "The team card could not be read.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
