"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/app/actions/achievements";
import { lookupStudentByStudentId } from "@/app/actions/records";
import {
  ACHIEVEMENT_TYPE_BEST_PLAYER,
  ACHIEVEMENT_TYPE_CHAMPION,
  NEW_SPORT_VALUE,
  achievementTypesFor,
  type AchievementCategory,
  type AchievementType,
} from "@/lib/constants";
import type { House, SportTrack, SportsAchievement } from "@/lib/types/database";
import { blankCell, csvFileSlug, downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { CertificateFields, CertificateList } from "@/components/certificate-viewer";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TableLoadingOverlay } from "@/components/table-loading-overlay";
import { useAppliedFilters } from "@/lib/use-applied-filters";
import { StudentDetailDialog, StudentTextButton } from "@/components/student-detail-dialog";
import { certificateOf } from "@/lib/certificates";
import { achievementsPath, type AchievementSection } from "@/lib/achievement-sections";

const PLACES = ["1st", "2nd", "3rd"] as const;

const CATEGORY_TABS: { value: AchievementCategory; label: string }[] = [
  { value: "other", label: "Other sports" },
  { value: "athletics", label: "Athletics" },
];

function categoryOf(achievement: SportsAchievement): AchievementCategory {
  return achievement.category === "athletics" ? "athletics" : "other";
}

function labelOf(achievement: SportsAchievement): string {
  if (categoryOf(achievement) === "athletics") {
    return achievement.sport_tracks?.name ?? achievement.sport;
  }
  return achievement.sport;
}

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
    if (!studentId.trim()) return;
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
        {studentId.trim() && hint && (
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
  initialCategory,
  hasCategories,
  houses,
  sports,
  tracks,
  teamCards,
  defaultYear,
  pending,
  error,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  achievement?: SportsAchievement;
  initialCategory: AchievementCategory;
  hasCategories: boolean;
  houses: House[];
  sports: string[];
  tracks: SportTrack[];
  teamCards: { id: string; event_name: string }[];
  defaultYear: number;
  pending: boolean;
  error: string | null;
  onSubmit: (formData: FormData) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const isEdit = Boolean(achievement);
  const [category, setCategory] = useState<AchievementCategory>(initialCategory);
  const athletics = category === "athletics";
  const typeOptions = achievementTypesFor(category);
  const initialType = (achievement?.achievement_type as AchievementType) ?? "";
  const [achievementType, setAchievementType] = useState<AchievementType | "">(
    initialType && (achievementTypesFor(initialCategory) as readonly string[]).includes(initialType)
      ? initialType
      : ""
  );
  const [sportChoice, setSportChoice] = useState(
    achievement && categoryOf(achievement) === "other" ? achievement.sport : ""
  );

  function changeCategory(next: AchievementCategory) {
    if (next === category) return;
    setCategory(next);
    setAchievementType("");
  }
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
  const studentRequired = athletics || achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER;
  const champion = !athletics && achievementType === ACHIEVEMENT_TYPE_CHAMPION;
  const options = sportChoices(sports, achievement?.sport);
  const linked = achievement ? certificateOf(achievement) : null;

  let studentLabel = "Student ID (optional)";
  let studentHelp = "Enter a student ID for a personal achievement. Leave blank for a team result.";
  if (athletics) {
    studentLabel = "Athlete student ID";
    studentHelp = "Enter the student ID of the athlete who placed in this event.";
  } else if (achievementType === ACHIEVEMENT_TYPE_BEST_PLAYER) {
    studentLabel = "Best Player student ID";
    studentHelp = "Enter one student ID for this house's Best Player award.";
  }

  return (
    <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={achievement!.id} />}
      {hasCategories && (
        <div className="sm:col-span-2">
          <input type="hidden" name="category" value={category} />
          <Label>Category</Label>
          <div
            role="group"
            aria-label="Achievement category"
            className="mt-1 inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
          >
            {CATEGORY_TABS.map((tab) => {
              const active = tab.value === category;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeCategory(tab.value)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium transition",
                    active
                      ? "bg-brand-navy text-white shadow-sm dark:bg-emerald-400 dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {athletics ? (
        <div>
          <Label>Event</Label>
          <Select name="track_id" required defaultValue={achievement?.track_id ?? ""}>
            <option value="" disabled>
              Select event
            </option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Events come from the athletic track list (Manage tracks).
          </p>
        </div>
      ) : (
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
      )}
      {!athletics && sportChoice === NEW_SPORT_VALUE && (
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
          {typeOptions.map((t) => (
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
      <div>
        <Label>Team card</Label>
        <Select name="team_card_id" defaultValue={achievement?.team_card_id ?? ""}>
          <option value="">No team card</option>
          {teamCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.event_name}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Only team cards already saved in this section are listed.
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
          <Label>{studentLabel}</Label>
          <Input
            name="winner_student_id"
            required={studentRequired}
            defaultValue={existingWinnerId}
            placeholder="e.g. 2024001"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{studentHelp}</p>
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
  section,
  title,
  headerActions,
  achievements,
  houses,
  sports,
  tracks,
  teamCards,
  hasCategories,
  defaultYear,
  selectedYear,
  years,
  canEdit,
}: {
  section: AchievementSection;
  title: string;
  headerActions?: React.ReactNode;
  achievements: SportsAchievement[];
  houses: House[];
  sports: string[];
  tracks: SportTrack[];
  teamCards: { id: string; event_name: string }[];
  hasCategories: boolean;
  defaultYear: number;
  selectedYear: number;
  years: number[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [yearFilter, setYearFilter] = useState(selectedYear);
  const [yearSource, setYearSource] = useState(selectedYear);
  if (selectedYear !== yearSource) {
    setYearSource(selectedYear);
    setYearFilter(selectedYear);
  }
  const [categoryFilter, setCategoryFilter] = useState<AchievementCategory | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingAchievement, setDeletingAchievement] = useState<SportsAchievement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [navPending, startNav] = useTransition();

  const activeCategory: AchievementCategory | "" = hasCategories ? categoryFilter : "other";
  const athletics = activeCategory === "athletics";
  let nameHeader = "Sport";
  if (athletics) nameHeader = "Event";
  else if (activeCategory === "") nameHeader = "Sport / Event";

  const inCategory = useMemo(
    () =>
      activeCategory
        ? achievements.filter((a) => categoryOf(a) === activeCategory)
        : achievements,
    [achievements, activeCategory]
  );

  const sportOptions = useMemo(() => {
    const trackNames = tracks.map((track) => track.name);
    let base = sports;
    if (activeCategory === "athletics") base = trackNames;
    else if (activeCategory === "") base = [...sports, ...trackNames];
    return [...new Set([...base, ...inCategory.map(labelOf)].filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [activeCategory, tracks, sports, inCategory]);

  const { applied, filtering } = useAppliedFilters({
    category: activeCategory,
    sport: sportFilter,
    query,
  });

  const filtered = useMemo(() => {
    const byCategory = applied.category
      ? achievements.filter((a) => categoryOf(a) === applied.category)
      : achievements;
    const sport = applied.sport.toLowerCase();
    const bySport = sport
      ? byCategory.filter((a) => labelOf(a).toLowerCase() === sport)
      : byCategory;
    const q = applied.query.trim().toLowerCase();
    if (!q) return bySport;
    return bySport.filter((achievement) => {
      const winners = achievement.sports_achievement_winners ?? [];
      const winnerText = winners
        .map((winner) => `${winner.students?.full_name ?? ""} ${winner.students?.student_id ?? ""}`)
        .join(" ");
      const reference = certificateOf(achievement)?.reference_no ?? "";
      return [labelOf(achievement), achievement.achievement_type, achievement.team_name, achievement.team_cards?.event_name, winnerText, achievement.notes, reference].some(
        (value) => (value ?? "").toLowerCase().includes(q)
      );
    });
  }, [achievements, applied]);

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
      router.push(achievementsPath(section, saved));
    } else {
      router.refresh();
    }
  }

  function handleAdd(formData: FormData) {
    setError(null);
    formData.set("section", section);
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
    formData.set("section", section);
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

  function closeDelete() {
    if (pending) return;
    setDeletingAchievement(null);
    setError(null);
  }

  function confirmDelete() {
    if (!deletingAchievement) return;
    const achievement = deletingAchievement;
    setError(null);
    startTransition(async () => {
      const result = await deleteAchievement(achievement.id, section);
      if (result.error) setError(result.error);
      else {
        setDeletingAchievement(null);
        if (editingId === achievement.id) closeForm();
      }
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function openAdd() {
    closeForm();
    setShowForm(true);
  }

  function exportCsv() {
    const categorySlug = hasCategories && activeCategory ? `-${activeCategory}` : "";
    const allLabel = athletics ? "all-events" : "all-sports";
    downloadCsv(
      `sports-achievements-${section}-${yearFilter}${categorySlug}-${csvFileSlug(sportFilter || allLabel)}.csv`,
      toCsv(
        ["Year", nameHeader, "Achievement", "Team", "Team card", "Winners", "Notes", "Reference no"],
        filtered.map((achievement) => [
          String(achievement.meet_year),
          blankCell(labelOf(achievement)),
          blankCell(achievement.achievement_type),
          blankCell(achievement.team_name),
          blankCell(achievement.team_cards?.event_name),
          winnerText(achievement),
          blankCell(achievement.notes),
          blankCell(certificateOf(achievement)?.reference_no),
        ])
      )
    );
  }

  const editingAchievement = editingId
    ? achievements.find((a) => a.id === editingId) ?? null
    : null;
  const formOpen = showForm || editingAchievement !== null;

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">{title}</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={filtered.length === 0}
            onClick={exportCsv}
          >
            Export
          </Button>
          {headerActions}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1 max-w-md">
          <Label htmlFor="achievement-search">Search achievements</Label>
          <Input
            id="achievement-search"
            placeholder={`${nameHeader}, type, house, winner, notes, reference…`}
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
              startNav(() => router.push(achievementsPath(section, y)));
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        {hasCategories && (
          <div>
            <Label htmlFor="ach-category-filter">Category</Label>
            <Select
              id="ach-category-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as AchievementCategory | "");
                setSportFilter("");
              }}
            >
              <option value="">All categories</option>
              {CATEGORY_TABS.map((tab) => (
                <option key={tab.value} value={tab.value}>
                  {tab.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor="ach-sport-filter">{nameHeader}</Label>
          <Select
            id="ach-sport-filter"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
          >
            <option value="">
              {athletics ? "All events" : activeCategory === "" ? "All sports and events" : "All sports"}
            </option>
            {sportOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        {canEdit && (
          <Button type="button" className="ml-auto" onClick={openAdd}>
            Add achievement
          </Button>
        )}
      </div>

      {error && !formOpen && (
        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
      )}

      <FormModal
        open={canEdit && showForm}
        title="New achievement"
        titleId="new-achievement-title"
        onClose={closeForm}
      >
        <AchievementForm
          key="new-achievement"
          initialCategory={activeCategory || "other"}
          hasCategories={hasCategories}
          houses={houses}
          sports={sports}
          tracks={tracks}
          teamCards={teamCards}
          defaultYear={defaultYear}
          pending={pending}
          error={error}
          onSubmit={handleAdd}
          submitLabel="Save achievement"
          onCancel={closeForm}
        />
      </FormModal>

      <FormModal
        open={canEdit && editingAchievement !== null}
        title={`Edit achievement — ${editingAchievement ? labelOf(editingAchievement) : ""}`}
        titleId="edit-achievement-title"
        onClose={closeForm}
      >
        {editingAchievement ? (
          <AchievementForm
            key={editingAchievement.id}
            achievement={editingAchievement}
            initialCategory={hasCategories ? categoryOf(editingAchievement) : "other"}
            hasCategories={hasCategories}
            houses={houses}
            sports={sports}
            tracks={tracks}
            teamCards={teamCards}
            defaultYear={defaultYear}
            pending={pending}
            error={error}
            onSubmit={handleUpdate}
            submitLabel="Save changes"
            onCancel={closeForm}
          />
        ) : null}
      </FormModal>

      <Card className="relative overflow-hidden p-0" aria-busy={navPending || filtering}>
        {(navPending || filtering) && <TableLoadingOverlay />}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">{nameHeader}</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Achievement</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Team</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Team card</th>
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
                  <td colSpan={canEdit ? 9 : 8} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No achievements for {yearFilter}.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-white/10"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {labelOf(a)}
                    </td>
                    <td className="px-4 py-3">{a.achievement_type}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {a.team_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {a.team_cards?.event_name && a.team_card_id ? (
                        <Link className="text-emerald-700 underline dark:text-emerald-300" href={`/team-cards?card=${a.team_card_id}`}>
                          {a.team_cards.event_name}
                        </Link>
                      ) : (
                        "—"
                      )}
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
                            onClick={() => {
                              setDeletingAchievement(a);
                              setError(null);
                            }}
                            disabled={pending}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {filtered.length} achievement(s) for {yearFilter}
          {sportFilter ? ` · ${sportFilter}` : ""}
          {query.trim() ? " · matching search" : ""}
        </p>
      </Card>
      <StudentDetailDialog studentId={openStudentId} onClose={() => setOpenStudentId(null)} />
      <ConfirmDialog
        open={canEdit && deletingAchievement !== null}
        title="Delete achievement?"
        titleId="delete-achievement-title"
        description={
          <>
            The achievement for{" "}
            <span className="font-medium text-zinc-900 dark:text-white">
              {deletingAchievement ? labelOf(deletingAchievement) : "this entry"}
            </span>{" "}
            will be permanently removed. This cannot be undone.
          </>
        }
        pending={pending}
        error={deletingAchievement ? error : null}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </div>
  );
}
