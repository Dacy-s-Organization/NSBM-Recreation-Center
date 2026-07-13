import { cn } from "@/lib/format";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400",
  secondary:
    "border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10",
  ghost:
    "bg-transparent text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:bg-red-500 dark:hover:bg-red-400",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
