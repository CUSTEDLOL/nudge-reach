import { CheckCircle2, CircleAlert } from "lucide-react";
import type { RunLogEntry } from "@/modules/automation/definitions";
import { stepMeta } from "./meta";

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Per-step run log list — used by the test-run panel and the runs page. */
export function RunLog({ entries }: { entries: RunLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-neutral-400">No steps were executed.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry, index) => {
        const meta = stepMeta(entry.kind);
        return (
          <li key={index} className="flex items-start gap-2.5 text-sm">
            {entry.ok ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <CircleAlert
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <p className="text-sm text-neutral-900">
                <span className="font-medium">
                  Step {entry.step} · {meta.label}
                </span>
                {entry.at && (
                  <span className="ml-2 text-xs text-neutral-400">
                    {timeFormat.format(new Date(entry.at))}
                  </span>
                )}
              </p>
              {entry.detail && (
                <p
                  className={`text-xs ${entry.ok ? "text-neutral-500" : "text-red-600"}`}
                >
                  {entry.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
