"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isOrgTabActive, ORG_TABS, orgTabHref } from "./nav";

/** Sub-navigation for one organisation. Horizontal, scrolls on small screens. */
export function OrgTabs({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Organisation sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-neutral-200">
        {ORG_TABS.map((tab) => {
          const active = isOrgTabActive(pathname, orgId, tab.slug);
          return (
            <li key={tab.slug}>
              <Link
                href={orgTabHref(orgId, tab.slug)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-[13.5px] font-medium transition-colors",
                  active
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
