import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

const WORDMARK_WIDTH = 1570;
const WORDMARK_HEIGHT = 334;

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
        "flex h-11 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        compact && "justify-center",
        className
      )}
    >
      {compact ? (
        <Image
          src="/icon.svg"
          alt=""
          width={32}
          height={32}
          priority
          unoptimized
          className="h-8 w-8 rounded-lg shadow-sm shadow-brand-900/10"
        />
      ) : (
        <Image
          src="/logo-mark.png"
          alt="Nudge"
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          priority
          unoptimized
          className="h-7 w-auto"
        />
      )}
    </Link>
  );
}
