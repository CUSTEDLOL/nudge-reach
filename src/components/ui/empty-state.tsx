import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  /** An icon element, e.g. `<Users className="h-5 w-5" />`. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** One primary CTA. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center",
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
