import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireFounder } from "@/modules/admin/auth";
import { newLeadsCount } from "@/modules/admin/leads";
import { AdminShell } from "@/components/features/admin-shell/admin-shell";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Founder admin shell — deliberately OUTSIDE the org-scoped (app) group: this
 * surface is platform-level (docs/plans/2026-09-05-admin-panel.md). The gate
 * runs here AND in every page/action (layouts don't re-run on soft
 * navigation). Nothing in the product links to /admin.
 */

export const metadata: Metadata = {
  title: "Nudge Admin",
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const founder = await requireFounder();
  const newLeads = await newLeadsCount();
  return (
    <ToastProvider>
      <AdminShell founderEmail={founder.email} newLeads={newLeads}>
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
