import type { ReactNode } from "react";

/**
 * The line above a Training section's box: title left; count and action
 * right, on the same baseline. `text-base` here is the only place that size
 * appears on the page — it is what makes the sections read as sections.
 *
 * Plain markup with no hooks, so the server page and the client-side rules
 * section (which owns its add form's open state) can share one copy.
 */
export function SectionHeader({
  id,
  title,
  meta,
  action,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-base font-semibold text-neutral-900">
        {title}
      </h2>
      <div className="flex items-center gap-3 text-sm text-neutral-500">
        {meta}
        {action}
      </div>
    </div>
  );
}
