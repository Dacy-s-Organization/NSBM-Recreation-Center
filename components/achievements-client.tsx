"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/app/actions/achievements";
import { lookupStudentByStudentId } from "@/app/actions/records";
import {
  ACHIEVEMENT_TYPES,
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  ACHIEVEMENT_TYPE_CHAMPION,
  NEW_SPORT_VALUE,
  type AchievementType,
} from "@/lib/constants";
import type { House, SportsAchievement } from "@/lib/types/database";
import { blankCell, downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { CertificateFields, CertificateList } from "@/components/certificate-viewer";
import { StudentDetailDialog, StudentTextButton } from "@/components/student-detail-dialog";
import { certificateOf } from "@/lib/certificates";

const PLACES = ["1st", "2nd", "3rd"] as const;

function PlaceStudentRow({
  index,
  place,
  studentId,
  onPlace,
  onStudentId,
  onRemove,
}: {
  index: number;
  place: string;
  studentId: string;
  onPlace: (place: string) => void;
  onStudentId: (studentId: string) => void;
  onRemove: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId.trim()) {
      setHint(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await lookupStudentByStudentId(studentId);
      if (cancelled) return;
      if (!result) setHint("Student not found");
      else {
        const row = result as { full_name?: string; nic?: string | null };
        setHint(`${row.full_name ?? "Student"}${row.nic ? ` · NIC ${row.nic}` : " · NIC not stored"}`);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentId]);

  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
      <Select name="place" value={place} onChange={(e) => onPlace(e.target.value)} aria-label={`Place ${index + 1}`}>
        {PLACES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Select>
      <div>
        <Input
          name="place_student_id"
          value={studentId}
          onChange={(e) => onStudentId(e.target.value)}
          placeholder="Student ID"
          aria-label={`Student ID for place ${index + 1}`}
        />
        {hint && (
          <p className={`mt-1 text-xs ${hint === "Student not found" ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
            {hint}
          </p>
        )}
      </div>
      <Button type="button" variant="ghost" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

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
  const [places, setPlaces] = useState(() => {
    const winners = achievement?.sports_achievement_winners ?? [];
    if (achievement?.achievement_type !== ACHIEVEMENT_TYPE_CHAMPION || winners.length === 0) {
      return [{ place: "1st", studentId: "" }];
    }
    return winners.map((winner) => ({
      place: winner.place && (PLACES as readonly string[]).includes(winner.place) ? winner.place : "1st",
      studentId: winner.students?.student_id ?? "",
    }));
  });
  const existingWinnerId =
    achievement?.achievement_type === ACHIEVEMENT_TYPE_CHAMPION
      ? ""
      : (achievement?.sports_achievement_winners?.[0]?.students?.student_id ?? "");
  const studentRequired = achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER;
  const champion = achievementType === ACHIEVEMENT_TYPE_CHAMPION;
  const options = sportChoices(sports, achievement?.sport);
  const linked = achievement ? certificateOf(achievement) : null;

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
        <Select name="team_name" defaultValue={houseNameForAchievement(achievement, houses)}>
          <option value="">No house</option>
          {houses.map((h) => (
            <option key={h.id} value={h.name}>
              {h.name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Optional. Leave blank when the result is not for a house.
        </p>
      </div>
      {champion ? (
        <div className="sm:col-span-2 space-y-3">
          <Label>Places</Label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Name and NIC come from the student record. Several students can share the same place.
          </p>
          {places.map((row, index) => (
            <PlaceStudentRow
              key={`${index}-${row.place}`}
              index={index}
              place={row.place}
              studentId={row.studentId}
              onPlace={(place) =>
                setPlaces((current) => current.map((item, i) => (i === index ? { ...item, place } : item)))
              }
              onStudentId={(studentId) =>
                setPlaces((current) => current.map((item, i) => (i === index ? { ...item, studentId } : item)))
              }
              onRemove={() => setPlaces((current) => current.filter((_, i) => i !== index))}
            />
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPlaces((current) => [...current, { place: "1st", studentId: "" }])}
          >
            Add place
          </Button>
        </div>
      ) : (
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
      )}
      <div className="sm:col-span-2">
        <Label>Notes (optional)</Label>
        <Input
          name="notes"
          defaultValue={achievement?.notes ?? ""}
          placeholder="Any extra info"
        />
      </div>
      <CertificateFields
        idPrefix={isEdit ? `achievement-${achievement!.id}` : "achievement-new"}
        referenceNo={linked?.reference_no}
        existing={isEdit ? (linked?.issued_certificates ?? []) : undefined}
      />
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
  const [query, setQuery] = useState("");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setYearFilter(selectedYear);
  }, [selectedYear]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return achievements;
    return achievements.filter((achievement) => {
      const winners = achievement.sports_achievement_winners ?? [];
      const winnerText = winners
        .map((winner) => `${winner.students?.full_name ?? ""} ${winner.students?.student_id ?? ""}`)
        .join(" ");
      const reference = certificateOf(achievement)?.reference_no ?? "";
      return [achievement.sport, achievement.achievement_type, achievement.team_name, winnerText, achievement.notes, reference].some(
        (value) => (value ?? "").toLowerCase().includes(q)
      );
    });
  }, [achievements, query]);

  function winnerText(achievement: SportsAchievement) {
    return (achievement.sports_achievement_winners ?? [])
      .map((winner) => {
        const place = winner.place ? `${winner.place} ` : "";
        const name = winner.students?.full_name ?? "";
        const studentId = winner.students?.student_id ?? "";
        if (name && studentId) return `${place}${name} (${studentId})`;
        return `${place}${name || studentId}`.trim();
      })
      .filter(Boolean)
      .join(", ");
  }

  function openSavedYear(formData: FormData) {
    const saved = parseInt(String(formData.get("meet_year") ?? ""), 10);
    if (!Number.isNaN(saved) && saved !== selectedYear) {
      router.push(`/achievements?year=${saved}`);
    } else {
      router.refresh();
    }
  }

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addAchievement(formData);
      if (result.error) setError(result.error);
      else {
        setShowForm(false);
        setError(null);
        openSavedYear(formData);
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
        openSavedYear(formData);
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

  function formatWinners(a: SportsAchievement) {
    const winners = a.sports_achievement_winners;
    if (!winners?.length) return "—";
    return winners.map((winner, index) => {
      const name = winner.students?.full_name;
      const studentId = winner.students?.student_id;
      const place = winner.place ? `${winner.place} ` : "";
      const label = name && studentId ? `${place}${name} (${studentId})` : `${place}${name ?? studentId ?? "?"}`;
      return (
        <span key={`${studentId ?? index}`}>
          {index > 0 ? ", " : ""}
          <StudentTextButton studentId={studentId} label={label.trim()} onOpen={setOpenStudentId} />
        </span>
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1 max-w-md">
          <Label htmlFor="achievement-search">Search achievements</Label>
          <Input
            id="achievement-search"
            placeholder="Sport, type, house, winner, notes, reference…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
        <Button
          type="button"
          variant="secondary"
          disabled={filtered.length === 0}
          onClick={() => {
            downloadCsv(
              `sports-achievements-${yearFilter}.csv`,
              toCsv(
                ["Sport", "Achievement", "Team", "Winners", "Notes", "Reference no"],
                filtered.map((achievement) => [
                  blankCell(achievement.sport),
                  blankCell(achievement.achievement_type),
                  blankCell(achievement.team_name),
                  winnerText(achievement),
                  blankCell(achievement.notes),
                  blankCell(certificateOf(achievement)?.reference_no),
                ])
              )
            );
          }}
        >
          Export
        </Button>
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
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Reference no</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Certificates</th>
                {canEdit && (
                  <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
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
                      <td colSpan={8} className="px-4 py-3">
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
                        <td className="px-4 py-3 font-mono">{certificateOf(a)?.reference_no ?? "—"}</td>
                        <td className="px-4 py-3">
                          <CertificateList certificates={certificateOf(a)?.issued_certificates ?? []} />
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
          {query.trim() ? " · matching search" : ""}
        </p>
      </Card>
      <StudentDetailDialog studentId={openStudentId} onClose={() => setOpenStudentId(null)} />
    </div>
  );
}
