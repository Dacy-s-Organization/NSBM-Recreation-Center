"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listBatches, renameBatch } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { normalizeBatchName, sameBatchName } from "@/lib/batch-name";
import type { BatchSummary } from "@/lib/data/students-nav";

export function BatchCustomizeDialog({
  faculty,
  intake,
}: {
  faculty?: string;
  intake?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [selected, setSelected] = useState("");
  const [nextName, setNextName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const named = normalizeBatchName(nextName);
  const current = batches.find((batch) => batch.intake === selected) ?? null;

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function openDialog() {
    setError(null);
    setNextName("");
    setOpen(true);
    startTransition(async () => {
      const result = await listBatches();
      if ("error" in result) {
        setError(result.error);
        setBatches([]);
        return;
      }
      setBatches(result.batches);
      const match = result.batches.find((batch) => batch.intake === intake);
      setSelected(match?.intake ?? result.batches[0]?.intake ?? "");
    });
  }

  function save() {
    if (!current) {
      setError("That batch was not found.");
      return;
    }
    if ("error" in named) {
      setError(named.error);
      return;
    }
    if (sameBatchName(current.intake, named.name)) {
      setError("That is already the batch name.");
      return;
    }
    const clash = batches.find((batch) => sameBatchName(batch.intake, named.name));
    if (clash) {
      setError(`A batch named "${clash.intake}" already exists.`);
      return;
    }
    const oldName = current.intake;
    const newName = named.name;
    startTransition(async () => {
      const result = await renameBatch(oldName, newName);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (faculty && intake === oldName) {
        router.push(`/students?faculty=${encodeURIComponent(faculty)}&intake=${encodeURIComponent(newName)}`);
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={openDialog}>
        Customize
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="customize-batch-title">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="customize-batch-title" className="font-medium text-zinc-900 dark:text-white">Customize batch name</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Renames the batch in every faculty. Students, records, and achievements stay attached.
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={close}>Close</Button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="customize-batch">Batch</Label>
                <Select id="customize-batch" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={pending || batches.length === 0}>
                  {batches.length === 0 && <option value="">No batches</option>}
                  {batches.map((batch) => (
                    <option key={batch.intake} value={batch.intake}>
                      {batch.intake} ({batch.total})
                    </option>
                  ))}
                </Select>
              </div>
              {current && (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Renames {current.total} student{current.total === 1 ? "" : "s"}: {current.faculties.map((item) => `${item.faculty} ${item.count}`).join(", ")}.
                </p>
              )}
              <div>
                <Label htmlFor="customize-batch-name">New name</Label>
                <Input id="customize-batch-name" value={nextName} maxLength={40} placeholder="25.1 MOHE" onChange={(event) => setNextName(event.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={close} disabled={pending}>Cancel</Button>
                <Button type="button" onClick={save} disabled={pending || !current || "error" in named}>
                  {pending ? "Saving…" : "Rename batch"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
