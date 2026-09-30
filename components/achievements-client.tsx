"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/app/actions/achievements";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  NEW_SPORT_VALUE,
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

function sportChoices(sports: string[], current?: string) {
  const names = [...sports];
  if (current && !names.some((name) => name.toLowerCase() === current.toLowerCase())) {
    names.push(current);
  }
  return names;
}

function AchievementForm({
  achievement,
  houses,
  sports,
  defaultYear,
  pending,
  error,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  achievement?: SportsAchievement;
  houses: House[];
  sports: string[];
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
  const [sportChoice, setSportChoice] = useState(achievement?.sport ?? "");
  const existingWinnerId =
    achievement?.sports_achievement_winners?.[0]?.students?.student_id ?? "";
  const studentRequired = achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER;
  const options = sportChoices(sports, achievement?.sport);

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={achievement!.id} />}
      <div>
        <Label>Sport</Label>
        <Select
          name="sport"
          required
          value={sportChoice}
          onChange={(e) => setSportChoice(e.target.value)}
        >
          <option value="" disabled>
            Select sport
          </option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={NEW_SPORT_VALUE}>Add a new sport</option>
        </Select>
      </div>
      {sportChoice === NEW_SPORT_VALUE && (
        <div className="sm:col-span-2">
          <Label>New sport</Label>
          <Input name="new_sport" required placeholder="Name of the new sport" />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This name is saved and appears in the sport menu after you save the achievement.
          </p>
        </div>
      )}
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
      <div className="sm:col-span-2">
        <Label>{studentRequired ? "Best Player student ID" : "Student ID (optional)"}</Label>
        <Input
          name="winner_student_id"
          required={studentRequired}
          defaultValue={existingWinnerId}
          placeholder="e.g. 2024001"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {studentRequired
            ? "Enter one student ID for this house's Best Player award."
            : "Enter a student ID for a personal achievement. Leave blank for a team result."}
        </p>
      </div>
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
        {error && <p className="w-full text-sm text-red-600 dark:text-red-300">{error}</p>}
      </div>
    </form>
  );
}

export function AchievementsClient({
  achievements,
  houses,
  sports,
  defaultYear,
  selectedYear,
  years,
  canEdit,
}: {
  achievements: SportsAchievement[];
  houses: House[];
  sports: string[];
  defaultYear: number;
  selectedYear: number;
  years: number[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [yearFilter, setYearFilter] = useState(selectedYear);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setYearFilter(selectedYear);
  }, [selectedYear]);

  const filtered = achievements;

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
    const winners = a.sports_achievement_winners;
    if (!winners?.length) return "—";
    return winners
      .map((w) => {
        const name = w.students?.full_name;
        const studentId = w.students?.student_id;
        if (name && studentId) return `${name} (${studentId})`;
        return name ?? studentId ?? "?";
      })
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
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              setYearFilter(y);
              router.push(`/achievements?year=${y}`);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        {canEdit && (
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
        )}
      </div>

      {error && !showForm && editingId === null && (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      )}

      {canEdit && showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">New sports achievement</h3>
          <div className="mt-4">
            <AchievementForm
              key="new-achievement"
              houses={houses}
              sports={sports}
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
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Sport</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Achievement</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Team</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Winners</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Notes</th>
                {canEdit && (
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No achievements for {yearFilter}.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-white/10"
                  >
                    {canEdit && editingId === a.id ? (
                      <td colSpan={6} className="px-4 py-3">
                        <p className="mb-3 font-medium text-zinc-900 dark:text-zinc-100">
                          Edit achievement
                        </p>
                        <AchievementForm
                          key={a.id}
                          achievement={a}
                          houses={houses}
                          sports={sports}
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
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {a.sport}
                        </td>
                        <td className="px-4 py-3">{a.achievement_type}</td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {a.team_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {formatWinners(a)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {a.notes || "—"}
                        </td>
                        {canEdit && (
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
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {filtered.length} achievement(s) for {yearFilter}
        </p>
      </Card>
    </div>
  );
}
