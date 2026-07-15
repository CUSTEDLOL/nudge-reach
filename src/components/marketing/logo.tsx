import Link from "next/link";
import { cn } from "@/lib/cn";

/** Nudge wordmark + mark. `tone="dark"` is for use on ink backgrounds;
 * `compact` renders the mark alone (navbar pill). */
export function Logo({
  tone = "light",
  compact = false,
  className,
}: {
  tone?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="Nudge home"
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-brand-500 shadow-[0_6px_16px_-6px_rgba(6,193,103,0.7)] transition-transform duration-300 group-hover:scale-105">
        {/* speech-bubble mark */}
        <svg
          viewBox="0 0 24 24"
          className="relative h-5 w-5 text-white"
          fill="none"
        >
          <path
            d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.5L6 21v-3H5A1.5 1.5 0 0 1 3.5 16.5V7A1.5 1.5 0 0 1 5 5.5Z"
            fill="currentColor"
            opacity="0.95"
          />
          <circle cx="9" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="12.5" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="16" cy="11.5" r="1.1" fill="#0b3d2e" />
        </svg>
      </span>
      {!compact && (
        <span
          className={cn(
            "font-logo text-[19px] font-bold tracking-tight",
            tone === "light" ? "text-ink night:text-white" : "text-white"
          )}
        >
          Nudge
        </span>
      )}
    </Link>
  );
}
