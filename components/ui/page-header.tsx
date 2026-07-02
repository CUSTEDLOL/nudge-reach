import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot for buttons/links. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        {description && (
          <div className="mt-1 text-sm text-neutral-500">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
