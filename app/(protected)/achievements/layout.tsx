import { Suspense } from "react";
import { AchievementsSubnav } from "@/components/achievements-subnav";

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Achievements</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Athletic records and sports achievements for the recreation center.
          </p>
        </div>
        <Suspense fallback={null}>
          <AchievementsSubnav />
        </Suspense>
      </div>
      {children}
    </div>
  );
}
