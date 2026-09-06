"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelp,
  FlaskConical,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/features/app-shell/brand-mark";
import {
  isNavItemActive,
  navGroupsForRole,
  type AppRole,
} from "@/components/features/app-shell/nav";

export type SidebarUser = { name: string; email: string };

export function Sidebar({
  role = "OWNER",
  simulation = false,
  orgName,
  user,
  collapsed,
  onCollapsedChange,
}: {
  role?: AppRole;
  simulation?: boolean;
  orgName: string;
  user: SidebarUser;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const pathname = usePathname();
  const groups = navGroupsForRole(role);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-neutral-200 bg-[#fbfcfb] transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[72px]" : "w-[232px]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col px-3 py-4">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          <BrandMark compact={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="grid h-10 w-10 place-items-center rounded-lg text-neutral-400 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
        </div>

        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mt-3 grid h-11 w-full place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-500 outline-none transition-colors hover:border-neutral-300 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
          </button>
        ) : (
          <div className="mt-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-neutral-900">
              {orgName}
            </p>
            <p
              className={cn(
                "mt-1 flex items-center gap-1.5 text-xs font-medium",
                simulation ? "text-sky-700" : "text-emerald-700"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  simulation ? "bg-sky-500" : "bg-emerald-500"
                )}
                aria-hidden
              />
              {simulation ? "Test workspace" : "Live workspace"}
            </p>
          </div>
        )}

        <nav aria-label="Main navigation" className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
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
                            "group relative flex h-11 items-center rounded-xl text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
                            collapsed ? "justify-center px-2" : "gap-3 px-3",
                            active
                              ? "bg-brand-50 font-semibold text-brand-800"
                              : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-2.5 h-6 w-[3px] rounded-r-full bg-brand-600"
                            />
                          )}
                          <Icon
                            className={cn(
                              "h-[19px] w-[19px] shrink-0",
                              active
                                ? "text-brand-700"
                                : "text-neutral-400 group-hover:text-neutral-700"
                            )}
                            aria-hidden
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3">
          {simulation && collapsed && (
            <div
              title="Test workspace — nothing reaches real customers"
              className="grid h-10 w-full place-items-center text-sky-600"
            >
              <FlaskConical className="h-[18px] w-[18px]" aria-hidden />
            </div>
          )}
          <SidebarUtilityLink
            href="mailto:support@nudgeagent.app"
            label="Help & support"
            icon={CircleHelp}
            collapsed={collapsed}
          />
          {role !== "AGENT" && (
            <SidebarUtilityLink
              href="/onboarding?customize=1"
              label="Customize workspace"
              icon={SlidersHorizontal}
              collapsed={collapsed}
            />
          )}
          <div
            className={cn(
              "mt-2 flex min-h-12 items-center border-t border-neutral-200 pt-3",
              collapsed ? "justify-center" : "gap-2.5"
            )}
          >
            <Avatar name={user.name} size="sm" />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{user.email}</p>
                </div>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    aria-label="Sign out"
                    title="Sign out"
                    className="grid h-10 w-10 place-items-center rounded-lg text-neutral-400 outline-none transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SidebarUtilityLink({
  href,
  label,
  icon: Icon,
  collapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-10 items-center rounded-lg text-sm text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500",
        collapsed ? "justify-center" : "gap-3 px-3"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}
