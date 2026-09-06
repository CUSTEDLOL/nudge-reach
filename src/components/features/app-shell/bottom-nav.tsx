"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { FlaskConical, LogOut, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { useMounted, useOverlay } from "@/components/ui/overlay";
import {
  isNavItemActive,
  mobilePrimaryItemsForRole,
  navGroupsForRole,
  type AppRole,
  type NavGroup,
} from "@/components/features/app-shell/nav";
import type { SidebarUser } from "@/components/features/app-shell/sidebar";

/** /inbox/[id] is a full-screen chat — the bar would crowd the composer there. */
export function isThreadRoute(pathname: string): boolean {
  return /^\/inbox\/[^/?#]+/.test(pathname);
}

/**
 * Mobile-only (< lg) fixed bottom navigation: Today, Inbox, Front Desk, Leads,
 * and a grouped More sheet. Desktop uses the adaptive sidebar.
 */
export function BottomNav({
  role = "OWNER",
  user,
  simulation = false,
}: {
  role?: AppRole;
  user: SidebarUser;
  simulation?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  if (isThreadRoute(pathname)) return null;

  const primary = mobilePrimaryItemsForRole(role);
  const primaryKeys = new Set(primary.map((item) => item.key));
  const secondaryGroups = navGroupsForRole(role).flatMap((group) => {
    const items = group.items.filter((item) => !primaryKeys.has(item.key));
    return items.length > 0 ? [{ ...group, items }] : [];
  });
  const moreActive = secondaryGroups.some((group) =>
    group.items.some((item) => isNavItemActive(pathname, item))
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {primary.map((item) => {
            const active = isNavItemActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
                  active ? "text-brand-700" : "text-neutral-500 active:text-neutral-800"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-11 items-center justify-center rounded-full transition-colors duration-150",
                    active && "bg-brand-50"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {item.mobileLabel}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More sections"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500",
              moreActive || moreOpen
                ? "text-brand-700"
                : "text-neutral-500 active:text-neutral-800"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-11 items-center justify-center rounded-full transition-colors duration-150",
                (moreActive || moreOpen) && "bg-brand-50"
              )}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </span>
            More
          </button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        groups={secondaryGroups}
        pathname={pathname}
        user={user}
        simulation={simulation}
      />
    </>
  );
}

/** Bottom sheet listing grouped secondary destinations + account block. */
function MoreSheet({
  open,
  onClose,
  groups,
  pathname,
  user,
  simulation,
}: {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  pathname: string;
  user: SidebarUser;
  simulation: boolean;
}) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panelRef);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center lg:hidden">
      <div
        className="absolute inset-0 bg-brand-950/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More sections"
        tabIndex={-1}
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lift outline-none motion-safe:animate-rise"
      >
        <div
          aria-hidden
          className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-neutral-200"
        />
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <div>
            <p className="text-base font-semibold text-neutral-950">More</p>
            <p className="text-xs text-neutral-500">
              Everything else in your workspace
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close more menu"
            className="grid h-11 w-11 place-items-center rounded-xl text-neutral-500 outline-none transition-colors active:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {simulation && (
          <p className="mx-4 mt-3 flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
            <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Test mode — nothing reaches real customers
          </p>
        )}
        <nav aria-label="More sections" className="p-2 pt-1">
          {groups.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500">
              Everything you can access is on the bar below.
            </p>
          )}
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                {group.label}
              </h2>
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-500",
                      active
                        ? "bg-brand-50 text-brand-800"
                        : "text-neutral-700 active:bg-neutral-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-brand-700" : "text-neutral-400"
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 border-t border-neutral-100 px-4 py-3">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">
              {user.name}
            </p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
