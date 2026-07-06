"use client";

import type { TooltipContentProps } from "recharts";

/**
 * Recharts tooltip content styled like the app's cards. Pass as
 * `<Tooltip content={ChartTooltip} />` from any chart wrapper.
 */
export function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[9rem] rounded-xl border border-black/5 bg-white px-3 py-2 shadow-lift">
      {label != null && label !== "" && (
        <p className="mb-1 text-xs font-medium text-neutral-900">
          {String(label)}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <p
            key={index}
            className="flex items-center gap-1.5 text-xs text-neutral-500"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? entry.fill ?? "#06c167" }}
            />
            <span>{entry.name != null ? String(entry.name) : ""}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums text-neutral-900">
              {Array.isArray(entry.value)
                ? entry.value.join(" – ")
                : entry.value != null
                  ? String(entry.value)
                  : "—"}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
