import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  delta,
  icon,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** e.g. `{ label: "+12% vs last month", direction: "up" }` */
  delta?: { label: string; direction?: "up" | "down" | "neutral" };
  /** An icon element, e.g. `<Users className="h-4 w-4" />`. */
  icon?: ReactNode;
  /** Small muted note under the value (e.g. "estimate"). */
  hint?: ReactNode;
  className?: string;
}) {
  const direction = delta?.direction ?? "neutral";
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {label}
        </p>
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
        {value}
      </p>
      {(delta || hint) && (
        <div className="mt-1 flex items-center gap-2">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                direction === "up" && "text-emerald-600",
                direction === "down" && "text-red-600",
                direction === "neutral" && "text-neutral-500"
              )}
            >
              {direction === "up" && (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              )}
              {direction === "down" && (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              )}
              {delta.label}
            </span>
          )}
          {hint && <span className="text-xs text-neutral-400">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
