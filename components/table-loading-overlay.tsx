export function TableLoadingOverlay({ label = "Loading results…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex items-start justify-center bg-white/70 pt-16 backdrop-blur-[1px] dark:bg-black/50"
    >
      <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-[var(--app-surface)] dark:text-zinc-200">
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent dark:border-emerald-400 dark:border-t-transparent"
        />
        {label}
      </div>
    </div>
  );
}
