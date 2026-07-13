export default function ProtectedLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-zinc-200 dark:bg-white/10" />
        <div className="h-4 w-96 max-w-full rounded bg-zinc-100 dark:bg-white/5" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 w-32 rounded-lg bg-zinc-200 dark:bg-white/10" />
        <div className="h-10 w-28 rounded-lg bg-zinc-100 dark:bg-white/5" />
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[var(--app-surface)]">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
          <div className="h-4 w-full rounded bg-zinc-200 dark:bg-white/10" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-b border-zinc-50 px-4 py-3 last:border-0 dark:border-white/10"
          >
            <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-white/5" />
            <div className="h-4 flex-1 rounded bg-zinc-100 dark:bg-white/5" />
            <div className="h-4 w-16 rounded bg-zinc-100 dark:bg-white/5" />
            <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
