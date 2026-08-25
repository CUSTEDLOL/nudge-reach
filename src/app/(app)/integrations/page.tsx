import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { MessageCircle, ShieldAlert, ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { getWhatsappAccount } from "@/modules/whatsapp/accounts";
import { getCalendarAccount } from "@/modules/calendar";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { CalendarCard } from "./calendar-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ApiKeysCard, type SerializedApiKey } from "./api-keys-card";
import { WebhooksCard, type SerializedWebhook } from "./webhooks-card";
import { CopyButton } from "./copy-button";
import { TestConnectionButton } from "./test-connection-button";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const ctx = await requireOrgContext();

  if (ctx.role === "AGENT") {
    return (
      <>
        <PageHeader
          title="Integrations"
          description="WhatsApp Cloud API connection, API keys and third-party hooks."
        />
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
          title="Integrations are managed by admins"
          description="Ask a workspace admin or the owner if a connection needs changing."
        />
      </>
    );
  }

  const [account, calendarAccount, apiKeys, endpoints, headerList] =
    await Promise.all([
      getWhatsappAccount(ctx.org.id),
      getCalendarAccount(ctx.org.id),
    prisma.apiKey.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEndpoint.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
    }),
    headers(),
  ]);

  const host = headerList.get("host") ?? "nudgeagent.app";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  const webhookUrl = `${proto}://${host}/api/webhooks/whatsapp`;

  const simulation = isSimulated(ctx.org);
  const canManage = ctx.role === "OWNER" || ctx.role === "ADMIN";

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
        title="Integrations"
        description="WhatsApp Cloud API connection, API keys and third-party hooks."
      />

      <div className="flex flex-col gap-6">
        {/* Hero: WhatsApp Cloud API */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-neutral-900">
                    WhatsApp Cloud API
                  </h2>
                  {account ? (
                    <Badge tone="success">Connected</Badge>
                  ) : simulation ? (
                    <Badge tone="info">Simulation</Badge>
                  ) : (
                    <Badge tone="neutral">Not connected</Badge>
                  )}
                </div>
                <p className="mt-1 max-w-xl text-sm text-neutral-500">
                  {account
                    ? `Sending as “${account.displayName}” over Meta's official Cloud API.`
                    : simulation
                      ? "Running in simulation — the whole product works with mocked Meta responses until you connect a real number."
                      : "Connect your WhatsApp Business account to start sending over the official Cloud API."}
                </p>
                {account && (
                  <p className="mt-2 font-mono text-xs text-neutral-500">
                    WABA {account.wabaId} · Phone {account.phoneNumberId}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <TestConnectionButton />
              <Link
                href="/settings/whatsapp"
                className={buttonVariants({
                  variant: account ? "secondary" : "primary",
                })}
              >
                {account ? "Edit connection" : "Connect"}
              </Link>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Webhook URL
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
              <code className="min-w-0 break-all font-mono text-sm text-neutral-900">
                {webhookUrl}
              </code>
              <CopyButton value={webhookUrl} label="Copy webhook URL" />
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Paste this in Meta&apos;s dashboard under WhatsApp → Configuration →
              Webhooks, and use your{" "}
              <code className="font-mono">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>{" "}
              environment value as the verify token.
            </p>
          </div>
        </Card>

        {/* AI Front Desk: real-calendar booking (the moat) */}
        <CalendarCard
          connected={Boolean(calendarAccount)}
          email={calendarAccount?.accountEmail}
          simulated={calendarAccount?.simulated ?? false}
          hasFrontDesk={planHasAiFrontDesk(ctx.org.plan)}
        />

        {/* Outbound webhooks (real — Zapier/Make/n8n/custom) */}
        <WebhooksCard webhooks={serializedWebhooks} canManage={canManage} />

        {/* API keys */}
        <ApiKeysCard keys={serializedKeys} canManage={canManage} />

        {/* Native e-commerce connector — genuinely not built yet */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            On the roadmap
          </h2>
          <Card className="flex items-start gap-3.5 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <ShoppingBag className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900">
                  Shopify &amp; WooCommerce
                </p>
                <Badge tone="neutral">Coming soon</Badge>
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                Native order &amp; customer sync. In the meantime, wire your store
                to Nudge today with a webhook above or the REST API keys.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
