import Link from "next/link";
import { cn } from "@/lib/format";

export function BackLink({
  href,
  label = "Back",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-zinc-900",
        className
      )}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}
