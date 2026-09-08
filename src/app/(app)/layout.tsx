import type { ReactNode } from "react";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { parseUiPreferences } from "@/modules/dashboard/workspace-profile";
import { AppShell } from "@/components/features/app-shell/shell";
import { ToastProvider } from "@/components/ui/toast";

/** Authenticated app shell: dark sidebar + topbar + toasts (spec §3.6). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const { org, role, email, membership } = await requireOrgContext();
  const uiPreferences = parseUiPreferences(membership.uiPreferences);

  const name =
    membership.displayName ||
    (email ? email.split("@")[0] : "Account");

  return (
    <ToastProvider>
      <AppShell
        orgName={org.name}
        user={{ name, email }}
        role={role}
        simulation={isSimulated(org)}
        initialSidebarCollapsed={uiPreferences.sidebarCollapsed}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
