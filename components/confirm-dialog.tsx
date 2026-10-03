"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  titleId,
  description,
  confirmLabel = "Delete",
  pending = false,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  titleId: string;
  description: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40">
        <h3 id={titleId} className="font-medium text-zinc-900 dark:text-white">
          {title}
        </h3>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={pending} autoFocus>
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
