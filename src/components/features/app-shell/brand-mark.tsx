import Link from "next/link";
import { cn } from "@/lib/cn";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      aria-label="Nudge Today"
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        compact && "justify-center",
        className
      )}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-600 text-white shadow-sm shadow-brand-900/10">
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          aria-hidden
        >
          <path
            d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8A1.5 1.5 0 0 1 19 16.5H9.5L6 21v-3H5A1.5 1.5 0 0 1 3.5 16.5V7A1.5 1.5 0 0 1 5 5.5Z"
            fill="currentColor"
          />
          <circle cx="9" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="12.5" cy="11.5" r="1.1" fill="#0b3d2e" />
          <circle cx="16" cy="11.5" r="1.1" fill="#0b3d2e" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[17px] font-bold tracking-[-0.02em] text-neutral-950">
          Nudge
        </span>
      )}
    </Link>
  );
}
