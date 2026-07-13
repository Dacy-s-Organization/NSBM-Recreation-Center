import { cn } from "@/lib/format";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[var(--app-surface)] dark:shadow-none",
        className
      )}
      {...props}
    />
  );
}
