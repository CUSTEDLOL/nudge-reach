import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SettingsNav } from "./settings-nav";

/**
 * Settings shell: left sub-nav + content column. AGENT-role members see a
 * friendly "ask an admin" state instead (server-checked; every mutation is
 * additionally requireRole-gated in its action).
 */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await requireOrgContext();

  if (role === "AGENT") {
    return (
      <>
        <PageHeader
          title="Settings"
          description="Workspace, team and channel configuration."
        />
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Settings are managed by admins"
          description="Your account has the agent role, which covers the inbox and contacts. Ask a workspace admin or the owner if something here needs to change."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Workspace, team and channel configuration."
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SettingsNav />
        <div className="min-w-0 max-w-3xl flex-1">{children}</div>
      </div>
    </>
  );
}
