import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition-colors duration-150 sm:h-9",
        "placeholder:text-neutral-400",
        "focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50",
        "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
        "aria-[invalid=true]:border-red-400",
        className
      )}
      {...props}
    />
  );
});
