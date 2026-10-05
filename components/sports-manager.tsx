"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSport, deleteSport } from "@/app/actions/sports";
import { addSportTrack, deleteSportTrack } from "@/app/actions/tracks";
import type { SportTrack } from "@/lib/types/database";
import { formatTrackUnitLabel } from "@/lib/constants";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";

type SportItem = { id: string; name: string };
type Tab = "sports" | "events";
type PendingDelete =
  | { kind: "sport"; id: string; name: string }
  | { kind: "event"; id: string; name: string };

const TABS: { value: Tab; label: string }[] = [
  { value: "sports", label: "Other sports" },
  { value: "events", label: "Athletic events" },
];

const headCell = "px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400";

export function SportsManager({
  sports,
  tracks,
}: {
  sports: SportItem[];
  tracks: SportTrack[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("sports");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PendingDelete | null>(null);
  const [pending, startTransition] = useTransition();
  const sportFormRef = useRef<HTMLFormElement>(null);
  const trackFormRef = useRef<HTMLFormElement>(null);

  function closeModal() {
    if (deleting) return;
    setOpen(false);
    setError(null);
  }

  function changeTab(next: Tab) {
    setTab(next);
    setError(null);
  }

  function handleAddSport(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSport(formData);
      if (result.error) setError(result.error);
      else {
        sportFormRef.current?.reset();
        router.refresh();
      }
    });
  }

  function handleAddTrack(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSportTrack(formData);
      if (result.error) setError(result.error);
      else {
        trackFormRef.current?.reset();
        router.refresh();
      }
    });
  }

  function closeDelete() {
    if (pending) return;
    setDeleting(null);
    setError(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setError(null);
    startTransition(async () => {
      const result =
        target.kind === "sport" ? await deleteSport(target.id) : await deleteSportTrack(target.id);
      if (result.error) setError(result.error);
      else {
        setDeleting(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Add sport
      </Button>

      <FormModal open={open} title="Sports and events" titleId="sports-manager-title" onClose={closeModal}>
        <div className="space-y-5">
          <div
            role="tablist"
            aria-label="Sport list"
            className="flex w-fit flex-wrap items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5"
          >
            {TABS.map((item) => {
              const selected = tab === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => changeTab(item.value)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition",
                    selected
                      ? "bg-emerald-500 text-zinc-950 shadow-sm dark:bg-emerald-400"
                      : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === "sports" ? (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sports listed here appear in the Sport menu when adding an achievement.
              </p>
              <form
                ref={sportFormRef}
                action={handleAddSport}
                className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <div>
                  <Label htmlFor="sport-name">Sport name</Label>
                  <Input id="sport-name" name="name" required placeholder="e.g. Badminton" />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding…" : "Add sport"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Events for athletic records and athletics achievements (e.g. 100m Run, Long Jump). Use
                seconds (s) for timed runs and meters (m) for jumps and throws.
              </p>
              <form
                ref={trackFormRef}
                action={handleAddTrack}
                className="grid gap-4 sm:grid-cols-3 sm:items-end"
              >
                <div>
                  <Label htmlFor="track-name">Event name</Label>
                  <Input id="track-name" name="name" required placeholder="e.g. 800m Run" />
                </div>
                <div>
                  <Label htmlFor="track-unit">Unit</Label>
                  <Select id="track-unit" name="unit" required defaultValue="s">
                    <option value="s">Seconds (s) — runs</option>
                    <option value="m">Meters (m) — jumps / throws</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      name="lower_is_better"
                      className="rounded border-zinc-300 dark:border-white/20"
                    />
                    Lower is better (faster times)
                  </label>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Add event"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {error && !deleting && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                {tab === "sports" ? (
                  <tr>
                    <th className={headCell}>Sport</th>
                    <th className={headCell}>Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th className={headCell}>Event</th>
                    <th className={headCell}>Unit</th>
                    <th className={headCell}>Lower is better</th>
                    <th className={headCell}>Actions</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {tab === "sports" ? (
                  sports.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-zinc-500 dark:text-zinc-400">
                        No sports yet.
                      </td>
                    </tr>
                  ) : (
                    sports.map((sport) => (
                      <tr key={sport.id} className="border-b border-zinc-50 last:border-0 dark:border-white/10">
                        <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{sport.name}</td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="danger"
                            disabled={pending}
                            onClick={() => {
                              setError(null);
                              setDeleting({ kind: "sport", id: sport.id, name: sport.name });
                            }}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )
                ) : tracks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-zinc-500 dark:text-zinc-400">
                      No events yet.
                    </td>
                  </tr>
                ) : (
                  tracks.map((track) => (
                    <tr key={track.id} className="border-b border-zinc-50 last:border-0 dark:border-white/10">
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{track.name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {formatTrackUnitLabel(track.unit)} ({track.unit})
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {track.lower_is_better ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="danger"
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setDeleting({ kind: "event", id: track.id, name: track.name });
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.kind === "sport" ? "Delete sport?" : "Delete event?"}
        titleId="delete-sport-item-title"
        description={
          <>
            <span className="font-medium text-zinc-900 dark:text-white">{deleting?.name}</span>{" "}
            {deleting?.kind === "sport"
              ? "will be removed from the sport menu. Existing achievements keep this sport name."
              : "will be permanently removed. This cannot be undone."}
          </>
        }
        pending={pending}
        error={deleting ? error : null}
        onConfirm={confirmDelete}
        onClose={closeDelete}
      />
    </>
  );
}
