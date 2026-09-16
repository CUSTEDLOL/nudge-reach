import type { Metadata } from "next";
import { headers } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { getCalendarAccount } from "@/modules/calendar";
import { getWidgetConfig } from "@/modules/widget";
import { isRazorpayConfigured } from "@/modules/billing/razorpay";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { getPlan } from "@/modules/billing/plans";
import { listConnections } from "@/modules/crm/connections";
import { buildAppCatalog } from "@/modules/integrations/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { AppsDirectory } from "./apps-directory";
import { ApiKeysCard, type SerializedApiKey } from "./api-keys-card";
import { CalendarCard } from "./calendar-card";
import { CrmCard } from "./crm-card";
import { crmCardModel } from "./crm-card-model";
import { PaymentsPanel } from "./payments-panel";
import { WebhooksCard, type SerializedWebhook } from "./webhooks-card";
import { WhatsappPanel } from "./whatsapp-panel";

export const metadata: Metadata = { title: "Apps" };

export default async function IntegrationsPage() {
  const ctx = await requireOrgContext();

  if (ctx.role === "AGENT") {
    return (
      <>
        <PageHeader
          title="Apps"
          description="The tools this workspace is connected to."
        />
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Apps are managed by admins"
          description="Ask a workspace admin or the owner if a connection needs changing."
        />
      </>
    );
  }

  const [
    account,
    calendarAccount,
    widget,
    apiKeys,
    endpoints,
    crmConnections,
    crmJobs,
    headerList,
  ] = await Promise.all([
    getWhatsappAccount(ctx.org.id),
    getCalendarAccount(ctx.org.id),
    getWidgetConfig(ctx.org.id),
    // All keys, including revoked ones: the management panel shows their
    // state. The tile counts only the live ones.
    prisma.apiKey.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEndpoint.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    }),
    listConnections(ctx.org.id),
    prisma.crmSyncJob.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    headers(),
  ]);

  const host = headerList.get("host") ?? "nudgeagent.app";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/whatsapp`;

  const simulation = isSimulated(ctx.org);
  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const hasPublicApi = getPlan(ctx.org.plan).limits.publicApi;
  const hasFrontDesk = planHasAiFrontDesk(ctx.org.plan);
  const apiGateMessage = hasPublicApi
    ? null
    : "API keys + webhooks are available from the Growth plan — upgrade in Settings → Billing.";

  const tiles = buildAppCatalog({
    whatsappConnected: Boolean(account),
    whatsappName: account?.displayName ?? null,
    simulation,
    calendarConnected: Boolean(calendarAccount),
    calendarEmail: calendarAccount?.accountEmail ?? null,
    calendarSimulated: calendarAccount?.simulated ?? false,
    zohoConnected: crmConnections.some(
      (c) => c.provider === "zoho" && c.status === "connected"
    ),
    salesforceConnected: crmConnections.some(
      (c) => c.provider === "salesforce" && c.status === "connected"
    ),
    webhookCount: endpoints.length,
    apiKeyCount: apiKeys.filter((key) => key.revokedAt === null).length,
    widgetEnabled: widget?.enabled ?? false,
    hasFrontDesk,
    hasPublicApi,
    paymentsLive: isRazorpayConfigured() && !simulation,
  });

  const serializedKeys: SerializedApiKey[] = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revoked: key.revokedAt !== null,
  }));

  const serializedWebhooks: SerializedWebhook[] = endpoints.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    lastStatus: w.lastStatus,
    lastDeliveryAt: w.lastDeliveryAt?.toISOString() ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Apps"
        description="Connect the tools you already use. Most of them take one click."
      />

      <AppsDirectory
        tiles={tiles}
        panels={{
          whatsapp: (
            <WhatsappPanel
              connected={Boolean(account)}
              displayName={account?.displayName ?? null}
              wabaId={account?.wabaId ?? null}
              phoneNumberId={account?.phoneNumberId ?? null}
              simulation={simulation}
              webhookUrl={webhookUrl}
            />
          ),
          calendar: (
            <CalendarCard
              connected={Boolean(calendarAccount)}
              email={calendarAccount?.accountEmail}
              simulated={calendarAccount?.simulated ?? false}
              hasFrontDesk={hasFrontDesk}
            />
          ),
          crm: (
            <CrmCard
              model={crmCardModel(crmConnections, crmJobs, simulation)}
              canManage={canManage}
            />
          ),
          webhooks: (
            <WebhooksCard
              webhooks={serializedWebhooks}
              canManage={canManage}
              gateMessage={apiGateMessage}
            />
          ),
          api: (
            <ApiKeysCard
              keys={serializedKeys}
              canManage={canManage}
              gateMessage={apiGateMessage}
            />
          ),
          payments: (
            <PaymentsPanel
              live={isRazorpayConfigured() && !simulation}
              currency={ctx.org.currency}
            />
          ),
        }}
      />
    </>
  );
}
