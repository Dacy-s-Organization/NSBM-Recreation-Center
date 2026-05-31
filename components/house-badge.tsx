import { DEFAULT_HOUSE_STYLE, HOUSE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/format";

export function HouseBadge({ name }: { name: string }) {
  const style = HOUSE_COLORS[name] ?? DEFAULT_HOUSE_STYLE;
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        style.bg,
        style.text,
        style.border
      )}
    >
      {name}
    </span>
  );
}
