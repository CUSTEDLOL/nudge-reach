import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/components/ui/label";

/**
 * Label + control + hint/error wrapper. Pass `htmlFor` matching the control's
 * `id` so the label is associated for a11y.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="text-red-500" aria-hidden>
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
