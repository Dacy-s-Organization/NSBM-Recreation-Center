"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type ExpandableCellProps = {
  label: string;
  value: string;
  className?: string;
  maxWidthClass?: string;
};

export function ExpandableCell({
  label,
  value,
  className = "",
  maxWidthClass = "max-w-[280px]",
}: ExpandableCellProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!value || value === "—") {
    return <span className={className}>—</span>;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block max-w-full cursor-pointer truncate rounded px-0.5 py-0.5 text-left text-zinc-700 underline-offset-2 hover:bg-zinc-50 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:text-zinc-300 dark:hover:bg-white/5 ${maxWidthClass} ${className}`}
        title="Click to view full text"
      >
        {value}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expandable-cell-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="expandable-cell-title"
              className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              {label}
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-white">
              {value}
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="button" variant="secondary" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
