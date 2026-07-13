import { cn } from "@/lib/format";
import type { LabelHTMLAttributes } from "react";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300",
        className
      )}
      {...props}
    />
  );
}
