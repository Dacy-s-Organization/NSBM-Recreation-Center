import { Suspense } from "react";
import { AchievementsSubnav } from "@/components/achievements-subnav";
import { SportsManager } from "@/components/sports-manager";
import { getSports, getSportTracks } from "@/lib/data/reference";
import { getStaffRole } from "@/lib/supabase/auth";
import type { SportTrack } from "@/lib/types/database";

export default async function AchievementsLayout({ children }: { children: React.ReactNode }) {
  const { role } = await getStaffRole();
  const canEdit = role === "super";
  const [tracks, sports] = canEdit
    ? await Promise.all([getSportTracks(), getSports()])
    : [[], []];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Achievements</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Athletic records and sports achievements for the recreation center.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Suspense fallback={null}>
            <AchievementsSubnav />
          </Suspense>
          {canEdit && (
            <SportsManager
              sports={sports.map((sport) => ({ id: sport.id, name: sport.name }))}
              tracks={tracks as SportTrack[]}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
