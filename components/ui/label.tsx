import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-neutral-700", className)}
      {...props}
    />
  );
});
