"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/refresh-button";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/students", label: "Students" },
  { href: "/achievements", label: "Achievements" },
  { href: "/inventory", label: "Inventory" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  return (
    <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-[var(--app-surface)]/90">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NSBM Green University Town"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-xl object-contain"
            priority
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              NSBM Green University
            </p>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Recreation <span className="text-emerald-600 dark:text-emerald-400">Center</span>
            </h1>
          </div>
        </div>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                pathname === link.href
                  ? "bg-emerald-500 text-zinc-950 shadow-sm dark:bg-emerald-400"
                  : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
          <Button type="button" variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
