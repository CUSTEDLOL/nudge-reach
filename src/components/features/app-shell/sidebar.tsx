"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/features/app-shell/brand-mark";
import {
  isNavChildActive,
  isNavItemActive,
  navGroupsForRole,
  type AppRole,
} from "@/components/features/app-shell/nav";

export type SidebarUser = { name: string; email: string };

/**
 * Desktop navigation rail. Deliberately plain: one nav, solid states, no
 * animated hovers. Workspace mode, help, customization and sign-out live in
 * the topbar so the rail fits a laptop viewport without scrolling.
 */
export function Sidebar({
  role = "OWNER",
  user,
  collapsed,
  onCollapsedChange,
}: {
  role?: AppRole;
  user: SidebarUser;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const currentTab = useSearchParams().get("tab");
  const groups = navGroupsForRole(role);

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
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-label={collapsed ? item.label : undefined}
                          title={collapsed ? item.label : undefined}
                          className={cn(
                            "flex h-9 items-center rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
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
                        </Link>

                        {/* Second level: only for the section you are in, so
                            the rail stays calm everywhere else. */}
                        {!collapsed && active && item.children && (
                          <ul className="mt-0.5 ml-[1.45rem] flex flex-col gap-0.5 border-l border-neutral-200 pl-2.5">
                            {item.children.map((child) => {
                              const here = isNavChildActive(child, currentTab);
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
    </aside>
  );
}
