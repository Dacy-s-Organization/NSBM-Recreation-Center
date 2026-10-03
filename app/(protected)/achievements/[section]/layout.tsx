import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AchievementsSectionTabs } from "@/components/achievements-section-tabs";
import { parseSection } from "@/lib/achievement-sections";

export default async function AchievementSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const section = parseSection((await params).section);
  if (!section) notFound();

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AchievementsSectionTabs section={section} />
      </Suspense>
      {children}
    </div>
  );
}
