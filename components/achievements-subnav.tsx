"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";
import {
  ACHIEVEMENT_SECTIONS,
  ACHIEVEMENT_SECTION_KEYS,
  achievementsPath,
  recordsPath,
} from "@/lib/achievement-sections";

export function AchievementsSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? undefined;

  return (
    <nav
      aria-label="Achievement sections"
      className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
    >
      {ACHIEVEMENT_SECTION_KEYS.map((section) => {
        const href = achievementsPath(section);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const onRecords = pathname.endsWith("/records");
        return (
          <Link
            key={section}
            href={onRecords ? recordsPath(section, year) : achievementsPath(section, year)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              active
                ? "bg-emerald-500 text-zinc-950 shadow-sm dark:bg-emerald-400"
                : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            )}
          >
            {ACHIEVEMENT_SECTIONS[section].label}
          </Link>
        );
      })}
    </nav>
  );
}
