import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Styled native select — accepts `<option>` children. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          className={cn(
            "h-9 w-full appearance-none rounded-lg border border-neutral-200 bg-white pl-3 pr-8 text-sm text-neutral-900 outline-none transition-colors duration-150",
            "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
      </div>
    );
  }
);
