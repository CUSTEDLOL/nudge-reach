import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: keyof typeof sizes;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex", className)}>
      <Loader2
        className={cn("animate-spin text-brand-600", sizes[size])}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
