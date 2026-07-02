import { cn } from "@/lib/cn";

export function Progress({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  /** Accessible name for the progress bar. */
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-neutral-100",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
