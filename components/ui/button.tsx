import { cn } from "@/lib/format";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200",
  ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
