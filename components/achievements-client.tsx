"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/app/actions/achievements";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  type AchievementType,
} from "@/lib/constants";
import type { House, SportsAchievement } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

function houseNameForAchievement(
  achievement: SportsAchievement | undefined,
  houses: House[]
): string {
  if (!achievement?.team_name) return "";
  const match = houses.find((h) => h.name === achievement.team_name);
  return match?.name ?? achievement.team_name;
}

function AchievementForm({
  achievement,
  houses,
  defaultYear,
  pending,
  error,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  achievement?: SportsAchievement;
  houses: House[];
  defaultYear: number;
  pending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(achievement);
  const initialType = (achievement?.achievement_type as AchievementType) ?? "";
  const [achievementType, setAchievementType] = useState(initialType);
  const existingWinnerId =
    achievement?.sports_achievement_winners?.[0]?.students?.student_id ?? "";

  const showBestPlayerField = achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER;

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={achievement!.id} />}
      <div>
        <Label>Sport</Label>
        <Input
          name="sport"
          required
          defaultValue={achievement?.sport ?? ""}
          placeholder="e.g. Basketball"
        />
      </div>
      <div>
        <Label>Achievement type</Label>
        <Select
          name="achievement_type"
          required
          value={achievementType}
          onChange={(e) => setAchievementType(e.target.value as AchievementType)}
        >
          <option value="" disabled>
            Select type
          </option>
          {ACHIEVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Year</Label>
        <Input
          name="meet_year"
          type="number"
          required
          defaultValue={achievement?.meet_year ?? defaultYear}
        />
      </div>
      <div>
        <Label>House (team)</Label>
        <Select
          name="team_name"
          required
          defaultValue={houseNameForAchievement(achievement, houses)}
        >
          <option value="" disabled>
            Select house
          </option>
          {houses.map((h) => (
            <option key={h.id} value={h.name}>
              {h.name}
            </option>
          ))}
        </Select>
      </div>
      {showBestPlayerField && (
        <div className="sm:col-span-2">
          <Label>Best Player student ID</Label>
          <Input
            name="winner_student_id"
            required
            defaultValue={existingWinnerId}
            placeholder="e.g. 2024001"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Enter one student ID for this house&apos;s Best Player award.
          </p>
        </div>
      )}
      <div className="sm:col-span-2">
        <Label>Notes (optional)</Label>
        <Input
          name="notes"
          defaultValue={achievement?.notes ?? ""}
          placeholder="Any extra info"
        />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}

export function AchievementsClient({
  achievements,
  houses,
  defaultYear,
}: {
  achievements: SportsAchievement[];
  houses: House[];
  defaultYear: number;
}) {
  const [yearFilter, setYearFilter] = useState(defaultYear);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const years = useMemo(() => {
    const set = new Set(achievements.map((a) => a.meet_year));
    set.add(defaultYear);
    return [...set].sort((a, b) => b - a);
  }, [achievements, defaultYear]);

  const filtered = useMemo(
    () => achievements.filter((a) => a.meet_year === yearFilter),
    [achievements, yearFilter]
  );

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAchievement(formData);
      if (result.error) setError(result.error);
      else {
        setShowForm(false);
        setError(null);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAchievement(formData);
      if (result.error) setError(result.error);
      else {
        setEditingId(null);
        setError(null);
      }
    });
  }

  function handleDelete(id: string, sport: string) {
    if (!window.confirm(`Delete sports achievement for ${sport}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAchievement(id);
      if (result.error) setError(result.error);
      else if (editingId === id) setEditingId(null);
    });
  }

  function formatWinners(a: SportsAchievement): string {
    if (a.achievement_type !== ACHIEVEMENT_TYPE_BEST_PLAYER) {
      return "—";
    }
    const winners = a.sports_achievement_winners;
    if (!winners?.length) return "—";
    return winners
      .map((w) => w.students?.full_name ?? w.students?.student_id ?? "?")
      .join(", ");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="ach-year-filter">Year</Label>
          <Select
            id="ach-year-filter"
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value, 10))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          className="ml-auto"
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setError(null);
          }}
        >
          {showForm ? "Cancel" : "Add achievement"}
        </Button>
      </div>

      {error && !showForm && editingId === null && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900">New sports achievement</h3>
          <div className="mt-4">
            <AchievementForm
              key="new-achievement"
              houses={houses}
              defaultYear={defaultYear}
              pending={pending}
              error={error}
              onSubmit={handleAdd}
              submitLabel="Save achievement"
            />
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600">Sport</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Achievement</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Team</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Winners</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Notes</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No achievements for {yearFilter}.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    {editingId === a.id ? (
                      <td colSpan={6} className="px-4 py-3">
                        <p className="mb-3 font-medium text-zinc-900">
                          Edit achievement
                        </p>
                        <AchievementForm
                          key={a.id}
                          achievement={a}
                          houses={houses}
                          defaultYear={defaultYear}
                          pending={pending}
                          error={error}
                          onSubmit={handleUpdate}
                          submitLabel="Save changes"
                          onCancel={() => {
                            setEditingId(null);
                            setError(null);
                          }}
                        />
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {a.sport}
                        </td>
                        <td className="px-4 py-3">{a.achievement_type}</td>
                        <td className="px-4 py-3 text-zinc-700">
                          {a.team_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {formatWinners(a)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {a.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(a.id);
                                setShowForm(false);
                                setError(null);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => handleDelete(a.id, a.sport)}
                              disabled={pending}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {filtered.length} achievement(s) for {yearFilter}
        </p>
      </Card>
    </div>
  );
}
