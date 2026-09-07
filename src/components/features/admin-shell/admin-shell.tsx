"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ExternalLink, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ADMIN_NAV, isAdminNavActive } from "./nav";

const LOGO_W = 1570;
const LOGO_H = 334;

export type AdminShellProps = {
  founderEmail: string;
  /** Leads still marked "new" — shown as a badge on the Leads item. */
  newLeads: number;
  children: ReactNode;
};

function NavList({
  pathname,
  newLeads,
  onNavigate,
}: {
  pathname: string;
  newLeads: number;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-5">
      {ADMIN_NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {group.label}
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              const Icon = item.icon;
              const badge = item.badge === "leads" && newLeads > 0 ? newLeads : null;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500",
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge !== null && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                          active ? "bg-white/20 text-white" : "bg-brand-50 text-brand-700"
                        )}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/admin" aria-label="Nudge admin overview" className="flex items-center gap-2">
      <Image
        src="/logo-mark.png"
        alt="Nudge"
        width={LOGO_W}
        height={LOGO_H}
        priority
        unoptimized
        className="h-6 w-auto"
      />
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800">
        Admin
      </span>
    </Link>
  );
}

function Footer({ founderEmail }: { founderEmail: string }) {
  return (
    <div className="mt-auto border-t border-neutral-200 pt-3">
      <p className="truncate px-3 text-xs text-neutral-500" title={founderEmail}>
        {founderEmail}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <Link
          href="/dashboard"
          className="flex h-9 flex-1 items-center gap-2 rounded-lg px-3 text-[13px] text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Open app
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Global org search — submits to the org list (name, member email or id). */
function SearchForm({ className }: { className?: string }) {
  return (
    <form action="/admin/orgs" method="get" role="search" className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        placeholder="Find an organisation — name, member email or id"
        aria-label="Find an organisation"
        className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-brand-500/30"
      />
    </form>
  );
}

/**
 * Founder panel chrome: left sidebar (desktop) / sheet (mobile), a top bar
 * with global org search, and the page body. Pure layout — the founder gate
 * runs in the server layout and in every page.
 */
export function AdminShell({ founderEmail, newLeads, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-neutral-200 bg-white px-3 py-4 lg:flex">
        <div className="px-3">
          <Brand />
        </div>
        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <NavList pathname={pathname} newLeads={newLeads} />
          <Footer founderEmail={founderEmail} />
        </div>
      </aside>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-neutral-900/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white px-3 py-4 shadow-2xl">
            <div className="flex items-center justify-between px-3">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <NavList pathname={pathname} newLeads={newLeads} onNavigate={() => setOpen(false)} />
              <Footer founderEmail={founderEmail} />
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <SearchForm className="flex-1 sm:max-w-xl" />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
