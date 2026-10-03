import Link from "next/link";
import { AddUserDialog } from "@/components/add-user-dialog";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/supabase/auth";
import {
  ACHIEVEMENT_SECTIONS,
  DEFAULT_ACHIEVEMENT_SECTION,
  recordsPath,
} from "@/lib/achievement-sections";
import { Card } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { role } = await getStaffRole();
  const canEdit = role === "super";
  const year = new Date().getFullYear();

  const [{ count: studentCount }, { count: inventoryCount }, ...recordCounts] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("inventory_items").select("*", { count: "exact", head: true }),
    ...Object.values(ACHIEVEMENT_SECTIONS).map((config) =>
      supabase
        .from(config.recordsTable)
        .select("*", { count: "exact", head: true })
        .eq("year", year)
    ),
  ]);
  const recordCount = recordCounts.reduce((sum, { count }) => sum + (count ?? 0), 0);

  const stats = [
    { label: "Students", value: studentCount ?? 0, href: "/students", accent: "bg-emerald-600 dark:bg-emerald-400" },
    { label: `Records (${year})`, value: recordCount, href: recordsPath(DEFAULT_ACHIEVEMENT_SECTION), accent: "bg-brand-navy" },
    { label: "Inventory items", value: inventoryCount ?? 0, href: "/inventory", accent: "bg-brand-cyan" },
  ];

  const quickLinks = [
    { href: "/students", title: "Manage students", desc: "Search by ID and assign houses" },
    { href: "/achievements", title: "Achievements", desc: "Athletic records and sports achievements" },
    { href: "/inventory", title: "Equipment inventory", desc: "Track quantities of gear" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Dashboard
        </h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          University recreation center overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.href} href={stat.href}>
            <Card className="relative overflow-hidden transition hover:border-emerald-400/60 hover:shadow-md dark:hover:border-emerald-400/40">
              <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${stat.accent}`} />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-white">
                {stat.value}
              </p>
            </Card>
          </Link>
        ))}
      </div>

      {canEdit ? <AddUserDialog /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition hover:border-emerald-400/60 dark:hover:border-emerald-400/40">
              <h3 className="font-medium text-zinc-900 dark:text-white">{link.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{link.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
