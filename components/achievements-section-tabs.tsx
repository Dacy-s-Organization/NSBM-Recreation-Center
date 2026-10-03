"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/format";
import {
  achievementsPath,
  recordsPath,
  type AchievementSection,
} from "@/lib/achievement-sections";

export function AchievementsSectionTabs({ section }: { section: AchievementSection }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const year = searchParams.get("year") ?? undefined;

  const tabs = [
    { label: "Achievements", base: achievementsPath(section), href: achievementsPath(section, year) },
    { label: "Athletic Records", base: recordsPath(section), href: recordsPath(section, year) },
  ];

  return (
    <nav
      aria-label="Achievement pages"
      className="inline-flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-white/10"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.base;
        return (
          <Link
            key={tab.label}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-emerald-500 text-zinc-900 dark:border-emerald-400 dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
