"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  NAV_GROUPS,
  activeNavChildKey,
  type NavItem,
} from "@/components/features/app-shell/nav";

/**
 * The AI employee's own tab strip. Owners told us setting the AI up meant
 * hopping between two unrelated sections, so every page that configures it —
 * what it knows, how it behaves, its phone line, what it can do — now shows
 * all four from wherever you are.
 *
 * The tabs are read from the sidebar's nav definition rather than restated
 * here, so the rail and this strip can never disagree.
 */
const FRONT_DESK: NavItem = NAV_GROUPS.flatMap((group) => group.items).find(
  (item) => item.key === "front-desk"
)!;

export function FrontDeskTabs() {
  const pathname = usePathname();
  const activeKey = activeNavChildKey(FRONT_DESK, pathname);

  return (
    <nav
      aria-label="AI Front Desk sections"
      // Scrolls rather than wrapping, so four tabs stay on one line on a phone.
      className="no-scrollbar -mx-4 mb-6 flex gap-4 overflow-x-auto border-b border-neutral-200 px-4 sm:mx-0 sm:gap-5 sm:px-0"
    >
      {(FRONT_DESK.children ?? []).map((child) => {
        const active = child.key === activeKey;
        return (
          <Link
            key={child.key}
            href={child.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-brand-400/50",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {child.label}
          </Link>
        );
      })}
    </nav>
  );
}
