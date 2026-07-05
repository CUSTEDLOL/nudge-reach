import type { ReactNode } from "react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { env } from "@/lib/env";
import { AppShell } from "@/components/features/app-shell/shell";
import { ToastProvider } from "@/components/ui/toast";

/** Authenticated app shell: dark sidebar + topbar + toasts (spec §3.6). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { org, role, email, membership } = await requireOrgContext();

  const name =
    membership.displayName ||
    (email ? email.split("@")[0] : "Account");

  return (
    <ToastProvider>
      <AppShell
        orgName={org.name}
        user={{ name, email }}
        role={role}
        simulation={env.SEND_MODE === "simulation"}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
