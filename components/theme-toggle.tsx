"use client";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/format";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, mounted, toggleTheme } = useTheme();
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white",
        className
      )}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      title={mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}
      suppressHydrationWarning
    >
      <span suppressHydrationWarning>
        {!mounted ? (
          <span className="h-4 w-4 rounded-full bg-zinc-300/80 dark:bg-zinc-600" aria-hidden />
        ) : isDark ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
