import { cn } from "@/lib/format";
import type { SelectHTMLAttributes } from "react";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20",
        className
      )}
      {...props}
    />
  );
}
