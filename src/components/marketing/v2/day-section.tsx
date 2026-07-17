import { cn } from "@/lib/cn";

/**
 * Daylight-zone wrapper — static by design. Every section is fully present
 * and opaque the moment the page paints; no scroll-in reveal, no fade, no
 * lift. Bold beats subtle here. (The wrapper is kept so sections can still
 * be grouped/styled as a unit.)
 */
export function DaySection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(className)}>{children}</div>;
}
