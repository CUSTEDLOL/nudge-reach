"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import {
  isNavItemActive,
  navItemsForRole,
  type AppRole,
} from "@/components/features/app-shell/nav";

export type SidebarUser = { name: string; email: string };

function BrandMark() {
  return (
    <Link
      href="/dashboard"
      aria-label="Nudge dashboard"
      className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
    >
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-400 to-brand-600">
        <span className="absolute inset-0 bg-[radial-gradient(80%_80%_at_30%_20%,rgba(255,255,255,0.45),transparent)]" />
        <svg viewBox="0 0 24 24" className="relative h-4.5 w-4.5 text-white" fill="none" aria-hidden>
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
      <span className="text-[17px] font-bold tracking-tight text-white">Nudge</span>
    </Link>
  );
}

/**
 * Desktop-only (lg+) dark sidebar. On mobile the app navigates through the
 * fixed bottom bar instead (components/app/bottom-nav.tsx).
 */
export function Sidebar({
  role = "OWNER",
  simulation = false,
  user,
}: {
  role?: AppRole;
  simulation?: boolean;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-brand-950 lg:flex">
      <div className="flex h-full flex-col px-3 py-5">
        <div className="px-3">
          <BrandMark />
        </div>

        <nav aria-label="Main navigation" className="mt-6 flex-1 space-y-0.5">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors duration-150",
                  "focus-visible:ring-2 focus-visible:ring-brand-400/60",
                  active
                    ? "bg-white/10 text-white"
                    : "text-brand-100/70 hover:bg-white/5 hover:text-white"
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3">
          {simulation && (
            <div className="mx-1 flex items-center gap-2 rounded-full border border-brand-400/25 bg-brand-400/10 px-3 py-1.5 text-xs font-medium text-brand-200">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Simulation mode
            </div>
          )}
          <div className="flex items-center gap-2.5 border-t border-white/10 px-1 pt-4">
            <Avatar name={user.name} size="sm" tone="inverse" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-brand-100/60">{user.email}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-lg p-2 text-brand-100/70 outline-none transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-400/60"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
