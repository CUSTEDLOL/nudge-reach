import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { checkCustomActions } from "@/modules/billing/limits";
import { isSimulated } from "@/modules/orgs/mode";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "../section-header";
import { CustomActionsCard, type SerializedCustomAction } from "./actions-card";

export const metadata: Metadata = { title: "Agent actions" };

export default async function CustomActionsPage() {
  const ctx = await requireOrgContext();
  const gate = await checkCustomActions(ctx.org.id);

  if (ctx.role === "AGENT") {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Agent actions"
          description="Connect your own systems so the AI answers with live data."
        />
        <EmptyState
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title="Managed by admins"
          description="Ask a workspace admin or the owner to configure agent actions."
        />
      </section>
    );
  }

  if (!gate.allowed) {
    return (
      <section className="flex flex-col gap-4">
        <SectionHeader
          title="Agent actions"
          description="Connect your own systems so the AI answers with live data."
        />
        <EmptyState
          icon={<Lock className="h-5 w-5" aria-hidden />}
          title="An Enterprise feature"
          description={gate.message}
        />
      </section>
    );
  }

  const rows = await prisma.customAction.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "asc" },
  });
  const actions: SerializedCustomAction[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    url: a.url,
    method: a.method,
    timeoutMs: a.timeoutMs,
    enabled: a.enabled,
    hasSecret: a.secretEncrypted !== null,
    inputSchema: JSON.stringify(a.inputSchema, null, 2),
  }));

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Agent actions"
        description="Point the AI at your own systems — order status, stock, appointments — and it answers customers with live data."
      />
      {isSimulated(ctx.org) && (
        <Card className="flex items-center gap-3 p-4">
          <Badge tone="info">Test mode</Badge>
          <p className="text-sm text-neutral-500">
            Actions run as safe mock calls until your WhatsApp number goes live —
            try the Test button or chat in <span className="font-mono">/inbox/try</span>.
          </p>
        </Card>
      )}
      <CustomActionsCard actions={actions} />
    </section>
  );
}
