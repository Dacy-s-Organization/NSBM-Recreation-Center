"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { addSportRecord, lookupStudentByStudentId } from "@/app/actions/records";
import type { SportRecord, SportTrack } from "@/lib/types/database";
import { formatRecordValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { HouseBadge } from "@/components/house-badge";

type LookupResult = {
  student_id: string;
  full_name: string;
  houses: { name: string } | null;
} | null;

export function RecordsClient({
  records,
  tracks,
  years,
  defaultYear,
}: {
  records: SportRecord[];
  tracks: SportTrack[];
  years: number[];
  defaultYear: number;
}) {
  const [year, setYear] = useState(defaultYear);
  const [trackId, setTrackId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [studentIdInput, setStudentIdInput] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!studentIdInput.trim()) {
      setLookup(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLookupLoading(true);
      const result = await lookupStudentByStudentId(studentIdInput);
      setLookup(result as LookupResult);
      setLookupLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [studentIdInput]);

  const filtered = useMemo(() => {
    let list = records.filter((r) => r.year === year);
    if (trackId) list = list.filter((r) => r.track_id === trackId);
    return [...list].sort((a, b) => {
      const trackA = a.sport_tracks?.name ?? "";
      const trackB = b.sport_tracks?.name ?? "";
      if (trackA !== trackB) return trackA.localeCompare(trackB);
      const lowerBetter = a.sport_tracks?.lower_is_better ?? false;
      if (lowerBetter) return Number(a.value) - Number(b.value);
      return Number(b.value) - Number(a.value);
    });
  }, [records, year, trackId]);

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSportRecord(formData);
      if (result.error) setError(result.error);
      else {
        setShowForm(false);
        setStudentIdInput("");
        setLookup(null);
      }
    });
  }

  const yearOptions =
    years.length > 0 ? years : [defaultYear, defaultYear - 1, defaultYear - 2];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="year-filter">Year</Label>
          <Select
            id="year-filter"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
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
        <Button type="button" className="ml-auto" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add record"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-medium text-zinc-900">New sport record</h3>
          <form action={handleAdd} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="student_id">Student ID</Label>
              <Input
                id="student_id"
                name="student_id"
                required
                value={studentIdInput}
                onChange={(e) => setStudentIdInput(e.target.value)}
              />
              {lookupLoading && (
                <p className="mt-1 text-xs text-zinc-500">Looking up…</p>
              )}
              {!lookupLoading && lookup && (
                <p className="mt-1 text-sm text-emerald-700">
                  {lookup.full_name}
                  {lookup.houses?.name && (
                    <span className="ml-2">
                      <HouseBadge name={lookup.houses.name} />
                    </span>
                  )}
                </p>
              )}
              {!lookupLoading && studentIdInput && !lookup && (
                <p className="mt-1 text-xs text-red-600">Student not found</p>
              )}
            </div>
            <div>
              <Label htmlFor="track_id">Track</Label>
              <Select id="track_id" name="track_id" required defaultValue="">
                <option value="" disabled>
                  Select track
                </option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="value">Record value</Label>
              <Input id="value" name="value" type="number" step="any" min="0" required />
            </div>
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                defaultValue={defaultYear}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save record"}
              </Button>
            </div>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-600">Student ID</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Name</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Track</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Record</th>
                <th className="px-4 py-3 font-medium text-zinc-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No records for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-mono">{r.students?.student_id}</td>
                    <td className="px-4 py-3">{r.students?.full_name}</td>
                    <td className="px-4 py-3">{r.sport_tracks?.name}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatRecordValue(Number(r.value), r.sport_tracks)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(r.recorded_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {filtered.length} record(s) for {year}
          {trackId ? ` · filtered by track` : ""}
        </p>
      </Card>
    </div>
  );
}
