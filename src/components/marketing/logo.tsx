import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

// Intrinsic size of the source asset (public/logo-mark*.png) — aspect ratio
// 1570:334 ≈ 4.7:1. Both files share the same alpha mask (green vs white
// fill), trimmed to the wordmark's own bounding box.
const LOGO_W = 1570;
const LOGO_H = 334;

/** The Nudge wordmark, from the real logo asset. `tone="dark"` is for use on
 * ink/dark backgrounds (renders the white variant); `tone="light"` (default)
 * is for white/cream backgrounds (renders the brand-green variant). */
export function Logo({
  tone = "light",
  className,
  id,
}: {
  tone?: "light" | "dark";
  className?: string;
  id?: string;
}) {
  return (
    <Link
      href="/"
      id={id}
      aria-label="Nudge home"
      className={cn("group inline-flex items-center", className)}
    >
      <Image
        src={tone === "dark" ? "/logo-mark-white.png" : "/logo-mark.png"}
        alt="Nudge"
        width={LOGO_W}
        height={LOGO_H}
        priority
        className="h-6 w-auto transition-transform duration-300 group-hover:scale-105 sm:h-7"
      />
    </Link>
  );
}
