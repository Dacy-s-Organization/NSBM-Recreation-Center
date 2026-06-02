"use client";

import { useMemo, useState, useTransition } from "react";
import { addAchievement, updateAchievement } from "@/app/actions/achievements";
import type { SportsAchievement } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export function AchievementsClient({
  achievements,
  defaultYear,
}: {
  achievements: SportsAchievement[];
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

  function AchievementForm({
    achievement,
    onSubmit,
    submitLabel,
  }: {
    achievement?: SportsAchievement;
    onSubmit: (formData: FormData) => void;
    submitLabel: string;
  }) {
    const isEdit = Boolean(achievement);
    const existingWinnerIds =
      achievement?.sports_achievement_winners
        ?.map((w) => w.students?.student_id)
        .filter(Boolean)
        .join(", ") ?? "";

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
          <Input
            name="achievement_type"
            required
            defaultValue={achievement?.achievement_type ?? ""}
            placeholder="e.g. Champion Team, Best Player"
          />
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
          <Label>Team name (optional)</Label>
          <Input
            name="team_name"
            defaultValue={achievement?.team_name ?? ""}
            placeholder="e.g. Sapphire Heroes"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Winner student IDs (comma-separated)</Label>
          <Input
            name="winner_student_ids"
            defaultValue={existingWinnerIds}
            placeholder="e.g. 2024001, 2024015, 2024032"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Enter student IDs separated by commas. Leave empty if not applicable.
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
          {isEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingId(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          )}
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </div>
      </form>
    );
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

      {showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900">New sports achievement</h3>
          <div className="mt-4">
            <AchievementForm onSubmit={handleAdd} submitLabel="Save achievement" />
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
                          achievement={a}
                          onSubmit={handleUpdate}
                          submitLabel="Save changes"
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
                          {a.sports_achievement_winners &&
                          a.sports_achievement_winners.length > 0
                            ? a.sports_achievement_winners
                                .map(
                                  (w) =>
                                    w.students?.full_name ??
                                    w.students?.student_id ??
                                    "?"
                                )
                                .join(", ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {a.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
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
