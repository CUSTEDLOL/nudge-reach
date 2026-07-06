import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type TagColor =
  | "emerald"
  | "sky"
  | "amber"
  | "red"
  | "violet"
  | "pink"
  | "blue"
  | "neutral";

const colors: Record<TagColor, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  pink: "bg-pink-50 text-pink-700",
  blue: "bg-blue-50 text-blue-700",
  neutral: "bg-neutral-100 text-neutral-600",
};

/**
 * Contact/conversation tag. `color` accepts any string (DB-stored) and falls
 * back to emerald. `onRemove` requires a client-component parent.
 */
export function TagPill({
  label,
  color = "emerald",
  onRemove,
  className,
}: {
  label: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}) {
  const colorClass = colors[color as TagColor] ?? colors.emerald;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
        className
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="-mr-0.5 rounded-full p-0.5 outline-none transition-colors duration-150 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-brand-400/50"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </span>
  );
}
