"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addSportRecord,
  deleteSportRecord,
  lookupStudentByStudentId,
  updateSportRecord,
} from "@/app/actions/records";
import type { SportRecord, SportTrack } from "@/lib/types/database";
import { formatTrackUnitLabel } from "@/lib/constants";
import { formatRecordValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { HouseBadge } from "@/components/house-badge";
import { FormModal } from "@/components/form-modal";
import { CertificateFields, CertificateList } from "@/components/certificate-viewer";
import { StudentDetailDialog, StudentTextButton } from "@/components/student-detail-dialog";
import { certificateOf } from "@/lib/certificates";
import { blankCell, csvFileSlug, downloadCsv, toCsv } from "@/lib/csv";
import { recordsPath, type AchievementSection } from "@/lib/achievement-sections";

type LookupResult = {
  student_id: string;
  full_name: string;
  houses: { name: string } | null;
} | null;

export function RecordsClient({
  section,
  title,
  headerActions,
  records,
  tracks,
  years,
  defaultYear,
  selectedYear,
  canEdit,
}: {
  section: AchievementSection;
  title: string;
  headerActions?: React.ReactNode;
  records: SportRecord[];
  tracks: SportTrack[];
  years: number[];
  defaultYear: number;
  selectedYear: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [year, setYear] = useState(selectedYear);
  const [trackId, setTrackId] = useState("");
  const [formTrackId, setFormTrackId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  useEffect(() => {
    setYear(selectedYear);
  }, [selectedYear]);
  const [pending, startTransition] = useTransition();

  const lookupActive = showForm || editingId !== null;

  useEffect(() => {
    setYear(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    if (!lookupActive || !studentIdInput.trim()) {
      setLookup(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const result = await lookupStudentByStudentId(studentIdInput);
        if (!cancelled) setLookup(result as LookupResult);
      } catch {
        if (!cancelled) setLookup(null);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentIdInput, lookupActive]);

  const filtered = useMemo(() => {
    let list = records;
    if (trackId) list = list.filter((r) => r.track_id === trackId);
    if (genderFilter) {
      list = list.filter((r) => (r.students?.gender ?? "").trim().toLowerCase() === genderFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const reference = certificateOf(r)?.reference_no ?? "";
        return [r.students?.student_id, r.students?.full_name, r.sport_tracks?.name, reference].some(
          (value) => (value ?? "").toLowerCase().includes(q)
        );
      });
    }
    return [...list].sort((a, b) => {
      const trackA = a.sport_tracks?.name ?? "";
      const trackB = b.sport_tracks?.name ?? "";
      if (trackA !== trackB) return trackA.localeCompare(trackB);
      const lowerBetter = a.sport_tracks?.lower_is_better ?? false;
      if (lowerBetter) return Number(a.value) - Number(b.value);
      return Number(b.value) - Number(a.value);
    });
  }, [records, trackId, genderFilter, query]);

  function openSavedYear(formData: FormData) {
    const saved = parseInt(String(formData.get("year") ?? ""), 10);
    if (!Number.isNaN(saved) && saved !== selectedYear) {
      router.push(recordsPath(section, saved));
    } else {
      router.refresh();
    }
  }

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSportRecord(formData);
      if (result.error) setError(result.error);
      else {
        setShowForm(false);
        setStudentIdInput("");
        setFormTrackId("");
        setLookup(null);
        openSavedYear(formData);
      }
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateSportRecord(formData);
      if (result.error) setError(result.error);
      else {
        setEditingId(null);
        setStudentIdInput("");
        setFormTrackId("");
        setLookup(null);
        openSavedYear(formData);
      }
    });
  }

  function startEdit(record: SportRecord) {
    setEditingId(record.id);
    setShowForm(false);
    setError(null);
    setStudentIdInput(record.students?.student_id ?? "");
    setFormTrackId(record.track_id);
    setLookup(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setStudentIdInput("");
    setFormTrackId("");
    setLookup(null);
    setError(null);
  }

  function openAdd() {
    closeForm();
    setShowForm(true);
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this sport record?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSportRecord(id, section);
      if (result.error) setError(result.error);
      else if (editingId === id) closeForm();
    });
  }

  function exportCsv() {
    const trackName = tracks.find((track) => track.id === trackId)?.name ?? "";
    downloadCsv(
      `athletic-records-${section}-${year}-${csvFileSlug(trackName)}-${csvFileSlug(genderFilter || "all-genders")}.csv`,
      toCsv(
        ["Student ID", "Name", "Track", "Record", "Year", "Date added", "Reference no"],
        filtered.map((record) => [
          blankCell(record.students?.student_id),
          blankCell(record.students?.full_name),
          blankCell(record.sport_tracks?.name),
          formatRecordValue(Number(record.value), record.sport_tracks),
          String(record.year),
          record.recorded_at ? new Date(record.recorded_at).toLocaleDateString() : "",
          blankCell(certificateOf(record)?.reference_no),
        ])
      )
    );
  }

  const editingRecord = editingId ? records.find((r) => r.id === editingId) ?? null : null;
  const formOpen = showForm || editingRecord !== null;

  const selectedFormTrack = useMemo(
    () => tracks.find((t) => t.id === formTrackId),
    [tracks, formTrackId]
  );

  const yearOptions =
    years.length > 0 ? years : [defaultYear, defaultYear - 1, defaultYear - 2];

  function StudentLookupHint() {
    if (lookupLoading) {
      return <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Looking up…</p>;
    }
    if (lookup) {
      return (
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          {lookup.full_name}
          {lookup.houses?.name && (
            <span className="ml-2">
              <HouseBadge name={lookup.houses.name} />
            </span>
          )}
        </p>
      );
    }
    if (studentIdInput.trim()) {
      return <p className="mt-1 text-xs text-red-600 dark:text-red-300">Student not found</p>;
    }
    return null;
  }

  function renderRecordForm({
    record,
    onSubmit,
    submitLabel,
  }: {
    record?: SportRecord;
    onSubmit: (formData: FormData) => void;
    submitLabel: string;
  }) {
    const isEdit = Boolean(record);
    const unitLabel = selectedFormTrack
      ? formatTrackUnitLabel(selectedFormTrack.unit)
      : "value";
    const valueStep =
      selectedFormTrack?.unit?.toLowerCase() === "s" ||
      selectedFormTrack?.unit?.toLowerCase() === "m"
        ? "0.01"
        : "any";

    const reference = record ? certificateOf(record)?.reference_no : undefined;
    const certificates = record ? certificateOf(record)?.issued_certificates ?? [] : [];

    return (
      <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="section" value={section} />
        {isEdit && <input type="hidden" name="id" value={record!.id} />}
        <div>
          <Label htmlFor={isEdit ? `student_id-${record!.id}` : "student_id"}>
            Student ID
          </Label>
          <Input
            id={isEdit ? `student_id-${record!.id}` : "student_id"}
            name="student_id"
            required
            value={studentIdInput}
            onChange={(e) => setStudentIdInput(e.target.value)}
          />
          <StudentLookupHint />
        </div>
        <div>
          <Label htmlFor={isEdit ? `track_id-${record!.id}` : "track_id"}>Track</Label>
          <Select
            id={isEdit ? `track_id-${record!.id}` : "track_id"}
            name="track_id"
            required
            value={formTrackId}
            onChange={(e) => setFormTrackId(e.target.value)}
          >
            {!isEdit && (
              <option value="" disabled>
                Select track
              </option>
            )}
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={isEdit ? `value-${record!.id}` : "value"}>
            Record value ({unitLabel})
          </Label>
          <Input
            id={isEdit ? `value-${record!.id}` : "value"}
            name="value"
            type="number"
            step={valueStep}
            min="0"
            required
            defaultValue={record?.value ?? undefined}
          />
          {selectedFormTrack?.lower_is_better && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Lower is better for this track.</p>
          )}
        </div>
        <div>
          <Label htmlFor={isEdit ? `year-${record!.id}` : "year"}>Year</Label>
          <Input
            id={isEdit ? `year-${record!.id}` : "year"}
            name="year"
            type="number"
            required
            defaultValue={record?.year ?? defaultYear}
          />
        </div>
        <CertificateFields
          idPrefix={isEdit ? `record-${record!.id}` : "record-new"}
          referenceNo={reference}
          existing={isEdit ? certificates : undefined}
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : submitLabel}
          </Button>
          <Button type="button" variant="secondary" onClick={closeForm}>
            Cancel
          </Button>
          {error && <p className="w-full text-sm text-red-600 dark:text-red-300">{error}</p>}
        </div>
      </form>
    );
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
          <Label htmlFor="record-search">Search records</Label>
          <Input
            id="record-search"
            placeholder="Student ID, name, track, reference…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="year-filter">Year</Label>
          <Select
            id="year-filter"
            value={year}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              setYear(y);
              router.push(recordsPath(section, y));
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="track-filter">Track</Label>
          <Select
            id="track-filter"
            value={trackId}
            onChange={(e) => setTrackId(e.target.value)}
          >
            <option value="">All tracks</option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="gender-filter">Gender</Label>
          <Select
            id="gender-filter"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="">All genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </div>
        {canEdit && (
          <Button type="button" className="ml-auto" onClick={openAdd}>
            Add record
          </Button>
        )}
      </div>

      {error && !formOpen && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <FormModal
        open={canEdit && showForm}
        title="New sport record"
        titleId="new-record-title"
        onClose={closeForm}
      >
        {renderRecordForm({ onSubmit: handleAdd, submitLabel: "Save record" })}
      </FormModal>

      <FormModal
        open={canEdit && editingRecord !== null}
        title={`Edit record — ${editingRecord?.students?.student_id ?? editingRecord?.students?.full_name ?? ""}`}
        titleId="edit-record-title"
        onClose={closeForm}
      >
        {editingRecord
          ? renderRecordForm({ record: editingRecord, onSubmit: handleUpdate, submitLabel: "Save changes" })
          : null}
      </FormModal>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Student ID</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Track</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Record</th>
                <th className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Date</th>
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
                    No records for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-white/10">
                        <td className="px-4 py-3 font-mono">
                          <StudentTextButton
                            studentId={r.students?.student_id}
                            label={r.students?.student_id ?? "—"}
                            onOpen={setOpenStudentId}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <StudentTextButton
                            studentId={r.students?.student_id}
                            label={r.students?.full_name ?? "—"}
                            onOpen={setOpenStudentId}
                          />
                        </td>
                        <td className="px-4 py-3">{r.sport_tracks?.name}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatRecordValue(Number(r.value), r.sport_tracks)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                          {new Date(r.recorded_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono">{certificateOf(r)?.reference_no ?? "—"}</td>
                        <td className="px-4 py-3">
                          <CertificateList certificates={certificateOf(r)?.issued_certificates ?? []} />
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => startEdit(r)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                onClick={() => handleDelete(r.id)}
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
          {filtered.length} record(s) for {year}
          {trackId ? ` · filtered by track` : ""}
          {genderFilter ? ` · filtered by gender` : ""}
          {query.trim() ? ` · matching search` : ""}
        </p>
      </Card>
      <StudentDetailDialog studentId={openStudentId} onClose={() => setOpenStudentId(null)} />
    </div>
  );
}
