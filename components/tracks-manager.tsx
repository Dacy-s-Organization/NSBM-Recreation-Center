"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSportTrack, deleteSportTrack } from "@/app/actions/tracks";
import type { SportTrack } from "@/lib/types/database";
import { formatTrackUnitLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export function TracksManager({ tracks }: { tracks: SportTrack[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSportTrack(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        (document.getElementById("add-track-form") as HTMLFormElement)?.reset();
        router.refresh();
      }
    });
  }

  function handleDelete(track: SportTrack) {
    if (!window.confirm(`Delete track "${track.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSportTrack(track.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(!open)}>
        {open ? "Close tracks" : "Manage tracks"}
      </Button>

      {open && (
        <Card className="mt-4">
          <h4 className="font-medium text-zinc-900 dark:text-white">Sport tracks</h4>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Add events for athletic records (e.g. 100m Run, Long Jump). Use seconds
            (s) for timed runs and meters (m) for jumps and throws.
          </p>

          <form
            id="add-track-form"
            action={handleAdd}
            className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end"
          >
            <div>
              <Label htmlFor="track-name">Track name</Label>
              <Input
                id="track-name"
                name="name"
                required
                placeholder="e.g. 800m Run"
              />
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
                {pending ? "Adding…" : "Add track"}
              </Button>
            </div>
          </form>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

          <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 dark:border-white/10 dark:bg-white/5">
                <tr>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Track</th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Unit</th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">
                    Lower is better
                  </th>
                  <th className="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tracks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-zinc-500 dark:text-zinc-400">
                      No tracks yet.
                    </td>
                  </tr>
                ) : (
                  tracks.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-50 last:border-0 dark:border-white/10">
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{t.name}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {formatTrackUnitLabel(t.unit)} ({t.unit})
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {t.lower_is_better ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => handleDelete(t)}
                          disabled={pending}
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
        </Card>
      )}
    </>
  );
}
