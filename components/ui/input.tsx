import { cn } from "@/lib/format";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 dark:border-white/10 dark:bg-[var(--app-surface-2)] dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/20",
        className
      )}
      {...props}
    />
  );
}
