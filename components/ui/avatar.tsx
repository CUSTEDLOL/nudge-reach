import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  tone = "brand",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  /** `inverse` renders light-on-dark for the sidebar. */
  tone?: "brand" | "inverse";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        tone === "brand"
          ? "bg-brand-100 text-brand-800"
          : "bg-white/10 text-white",
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
