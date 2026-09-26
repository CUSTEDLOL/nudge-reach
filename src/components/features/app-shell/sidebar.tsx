"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Lock, PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/features/app-shell/brand-mark";
import {
  activeNavChildKey,
  isNavItemActive,
  lockedNavGroupsForMode,
  navGroupsForMode,
  type AppShellMode,
  type AppRole,
} from "@/components/features/app-shell/nav";
import { UpgradeDialog } from "@/components/features/trial/upgrade-dialog";
import { useInboxPoll } from "@/app/(app)/inbox/use-inbox-poll";
import type { AttentionCounts } from "@/modules/inbox/queries";

export type SidebarUser = { name: string; email: string };

/**
 * Desktop navigation rail. Deliberately plain: one nav, solid states, no
 * animated hovers. Workspace mode, help, customization and sign-out live in
 * the topbar so the rail fits a laptop viewport without scrolling.
 */
export function Sidebar({
  role = "OWNER",
  mode = "standard",
  user,
  collapsed,
  onCollapsedChange,
}: {
  role?: AppRole;
  mode?: AppShellMode;
  user: SidebarUser;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const groups = [
    ...navGroupsForMode(mode, role),
    ...lockedNavGroupsForMode(mode, role),
  ];
  // Which locked feature the visitor just asked about, if any.
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const counts = useAttentionCounts(mode === "standard");
  const badgeFor = (key: string) =>
    key === "inbox"
      ? counts?.unread
      : key === "bookings"
        ? counts?.pendingBookings
        : undefined;

  const iconButton =
    "grid h-9 w-9 place-items-center rounded-md text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[72px]" : "w-[232px]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col px-3 py-3">
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-between pl-1"
          )}
        >
          <BrandMark compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className={iconButton}
            >
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className={cn(iconButton, "mx-auto mt-2")}
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          </button>
        )}

        <nav
          aria-label="Main navigation"
          className="mt-4 min-h-0 flex-1 overflow-y-auto"
        >
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isNavItemActive(pathname, item);
                    const Icon = item.icon;

                    // Locked rows are buttons, never links: the route guard
                    // would bounce them, and a dead link reads as a bug. The
                    // point is to show what paying unlocks, then ask for it.
                    if (group.locked) {
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            onClick={() => setLockedFeature(item.label)}
                            aria-label={`${item.label} — available on a paid plan`}
                            title={
                              collapsed
                                ? `${item.label} — available on a paid plan`
                                : undefined
                            }
                            className={cn(
                              "flex h-9 w-full items-center rounded-md text-sm font-medium text-neutral-400 outline-none hover:bg-neutral-50 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                              collapsed ? "justify-center px-2" : "gap-2.5 px-2.5"
                            )}
                          >
                            <Icon
                              className="h-[18px] w-[18px] shrink-0 text-neutral-300"
                              aria-hidden
                            />
                            {!collapsed && (
                              <>
                                <span className="truncate">{item.label}</span>
                                <Lock
                                  className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-400"
                                  aria-hidden
                                />
                              </>
                            )}
                          </button>
                        </li>
                      );
                    }

                    const badge = badgeFor(item.key);
                    const badgeText = badge && badge > 99 ? "99+" : badge;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          data-tour={item.tourTarget}
                          aria-current={active ? "page" : undefined}
                          aria-label={
                            collapsed || badge
                              ? `${item.label}${badge ? `, ${badge} waiting` : ""}`
                              : undefined
                          }
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "relative flex h-9 items-center rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                            collapsed ? "justify-center px-2" : "gap-2.5 px-2.5",
                            active
                              ? "bg-brand-700 text-white"
                              : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0",
                              active ? "text-white" : "text-neutral-500"
                            )}
                            aria-hidden
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {badge ? (
                            <span
                              aria-hidden
                              className={cn(
                                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                                collapsed
                                  ? "absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px]"
                                  : "ml-auto",
                                active
                                  ? "bg-white text-brand-800"
                                  : "bg-[#25d366] text-white"
                              )}
                            >
                              {badgeText}
                            </span>
                          ) : null}
                        </Link>

                        {/* Chats the AI handed off are the one thing that
                            cannot wait, so they get a row of their own — but
                            only while there are some. */}
                        {!collapsed && item.key === "inbox" && counts?.needsHuman ? (
                          <Link
                            href="/inbox?filter=handoff"
                            className="mt-0.5 ml-[1.45rem] flex h-8 items-center gap-2 rounded-md border-l border-neutral-200 pl-2.5 pr-2.5 text-[13px] font-medium text-amber-800 outline-none hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                          >
                            <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">Needs human</span>
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-900">
                              {counts.needsHuman}
                            </span>
                          </Link>
                        ) : null}

                        {/* Second level, always open. Hiding it until you were
                            already inside the section is what made setting the
                            AI up feel like a hunt (founder, 2026-09-16). */}
                        {!collapsed && item.children && (
                          <ul className="mt-0.5 ml-[1.45rem] flex flex-col gap-0.5 border-l border-neutral-200 pl-2.5">
                            {item.children.map((child) => {
                              const here =
                                child.key === activeNavChildKey(item, pathname);
                              return (
                                <li key={child.key}>
                                  <Link
                                    href={child.href}
                                    aria-current={here ? "page" : undefined}
                                    className={cn(
                                      "flex h-8 items-center rounded-md px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                                      here
                                        ? "font-semibold text-brand-800"
                                        : "font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                                    )}
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div
          className={cn(
            "mt-3 flex items-center border-t border-neutral-200 pt-3",
            collapsed ? "justify-center" : "gap-2.5 px-1"
          )}
        >
          <Avatar name={user.name} size="sm" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">
                {user.name}
              </p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
            </div>
          )}
        </div>
      </div>

      <UpgradeDialog
        open={lockedFeature !== null}
        onClose={() => setLockedFeature(null)}
        featureName={lockedFeature ?? ""}
      />
    </aside>
  );
}

/**
 * Live counts for the rail, polled like the inbox (paused while the tab is
 * hidden or the person is idle). Standard workspaces only — a trial has no
 * real conversations to count.
 */
function useAttentionCounts(enabled: boolean): AttentionCounts | null {
  const [counts, setCounts] = useState<AttentionCounts | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const next = await fetchAttentionCounts();
    if (next) setCounts(next);
  }, [enabled]);

  // First read right away; the poll then refreshes every 15s.
  useEffect(() => {
    if (!enabled) return;
    fetchAttentionCounts()
      .then((next) => next && setCounts(next))
      .catch(() => {});
  }, [enabled]);
  useInboxPoll(refresh, 15_000);

  return enabled ? counts : null;
}

async function fetchAttentionCounts(): Promise<AttentionCounts | null> {
  const res = await fetch("/api/inbox/counts", { cache: "no-store" });
  return res.ok ? ((await res.json()) as AttentionCounts) : null;
}
