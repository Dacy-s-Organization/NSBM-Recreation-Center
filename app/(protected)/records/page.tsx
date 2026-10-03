import { redirect } from "next/navigation";
import { DEFAULT_ACHIEVEMENT_SECTION, recordsPath } from "@/lib/achievement-sections";

export default function RecordsPage() {
  redirect(recordsPath(DEFAULT_ACHIEVEMENT_SECTION));
}
