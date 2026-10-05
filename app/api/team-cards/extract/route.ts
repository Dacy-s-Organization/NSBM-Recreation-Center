import { NextResponse } from "next/server";
import { getStaffRole } from "@/lib/supabase/auth";
import { extractOffice, sourceKindFor } from "@/lib/team-cards/office";
import { extractOcrPasses } from "@/lib/team-cards/rows";
import { recognizeWindowsImage } from "@/lib/team-cards/windows-ocr";

export const runtime = "nodejs";

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
    const message = error instanceof Error ? error.message : "The team card could not be read.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
