import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireFounder } from "@/modules/admin/auth";

/**
 * Founder admin shell — deliberately OUTSIDE the org-scoped (app) group: this
 * surface is platform-level (docs/plans/2026-09-05-admin-panel.md). The gate
 * runs here AND in every page (layouts don't re-run on soft navigation).
 * Nothing in the product links to /admin.
 */

export const metadata: Metadata = {
  title: "Nudge Admin",
  robots: { index: false },
};

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orgs", label: "Orgs" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/ops", label: "Ops" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const founder = await requireFounder();

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            Nudge Admin
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              founders only
            </span>
          </div>
          <span className="text-xs text-neutral-500">{founder.email}</span>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-t-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
