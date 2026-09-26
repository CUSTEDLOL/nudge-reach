import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleX, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireFounder } from "@/modules/admin/auth";
import {
  checkPaymentAccount,
  checkPlatformIntegrations,
  checkWhatsappNumber,
  type HealthState,
  type IntegrationHealth,
} from "@/modules/admin/integration-health";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

const LOOK: Record<HealthState, { label: string; icon: LucideIcon; row: string; pill: string }> = {
  ok: { label: "Working", icon: CheckCircle2, row: "text-emerald-700", pill: "bg-emerald-50 text-emerald-800" },
  warn: { label: "Needs attention", icon: TriangleAlert, row: "text-amber-700", pill: "bg-amber-50 text-amber-900" },
  fail: { label: "Broken", icon: CircleX, row: "text-red-700", pill: "bg-red-50 text-red-800" },
  off: { label: "Not set up", icon: CircleDashed, row: "text-neutral-400", pill: "bg-neutral-100 text-neutral-600" },
};

/**
 * Founder-only: every integration checked live, with production's own keys,
 * each time the page loads. All calls are read-only and free.
 */
export default async function AdminIntegrationsPage() {
  await requireFounder();
  const processEnv = process.env as Record<string, string | undefined>;

  const [heartbeat, accounts, paymentAccounts] = await Promise.all([
    prisma.systemHeartbeat.findUnique({ where: { key: "process-queue" }, select: { lastSeenAt: true } }),
    prisma.whatsappAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        displayName: true,
        wabaId: true,
        phoneNumberId: true,
        accessTokenEncrypted: true,
        org: {
          select: {
            id: true,
            name: true,
            whatsappConnection: { select: { verifiedAt: true, lastInboundAt: true } },
          },
        },
      },
    }),
    prisma.paymentConnection.findMany({
      select: { keyId: true, keySecretEncrypted: true, lastEventAt: true, org: { select: { name: true } } },
    }),
  ]);

  const orgIds = [...new Set(accounts.map((a) => a.org.id))];
  const templateCounts = orgIds.length
    ? await prisma.template.groupBy({
        by: ["orgId", "metaStatus"],
        where: { orgId: { in: orgIds }, campaignId: null, metaStatus: { in: ["PENDING", "REJECTED"] } },
        _count: { _all: true },
      })
    : [];
  const count = (orgId: string, status: string) =>
    templateCounts.find((t) => t.orgId === orgId && t.metaStatus === status)?._count._all ?? 0;

  const [platform, numbers, payments] = await Promise.all([
    checkPlatformIntegrations(processEnv, fetch, { heartbeatAt: heartbeat?.lastSeenAt ?? null }),
    Promise.all(
      paymentAccounts.map((c) => {
        let keySecret = "";
        try {
          keySecret = decryptSecret(c.keySecretEncrypted);
        } catch {
          keySecret = "";
        }
        return checkPaymentAccount({ orgName: c.org.name, keyId: c.keyId, keySecret, lastEventAt: c.lastEventAt }, fetch);
      })
    ),
    Promise.all(
      accounts.map((a) => {
        let accessToken = "";
        try {
          accessToken = decryptSecret(a.accessTokenEncrypted);
        } catch {
          accessToken = "";
        }
        return checkWhatsappNumber(
          {
            orgName: a.org.name,
            displayName: a.displayName,
            wabaId: a.wabaId,
            phoneNumberId: a.phoneNumberId,
            accessToken,
            connection: a.org.whatsappConnection,
            pendingTemplates: count(a.org.id, "PENDING"),
            rejectedTemplates: count(a.org.id, "REJECTED"),
          },
          fetch,
          env.WHATSAPP_API_VERSION || "v23.0"
        );
      })
    ),
  ]);

  const whatsapp: IntegrationHealth[] = numbers.length
    ? numbers
    : [{ key: "whatsapp", name: "WhatsApp numbers", state: "off", summary: "No workspace has connected a number yet.", fix: "Connect one in the client's Settings → WhatsApp, with a permanent System User token." }];
  const customerPayments: IntegrationHealth[] = payments.length
    ? payments
    : [{ key: "payments", name: "Customer payments (each workspace's own Razorpay)", state: "off", summary: "No workspace has connected its Razorpay yet. Their AI tells customers the team will share payment details.", fix: "The owner connects it in Apps → Razorpay." }];
  const all = [...platform, ...whatsapp, ...customerPayments];
  const tally = (s: HealthState) => all.filter((r) => r.state === s).length;

  return (
    <div>
      <PageHeader
        title="Integrations"
        description={`Checked live with production's keys just now (${new Date().toISOString().slice(11, 16)} UTC). Read-only, free calls.`}
        actions={
          <Link href="/admin/integrations" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Check again
          </Link>
        }
      />

      <p className="mb-5 flex flex-wrap gap-2 text-sm">
        {(["ok", "warn", "fail", "off"] as HealthState[]).map((s) => (
          <span key={s} className={`rounded-full px-2.5 py-1 text-xs font-medium ${LOOK[s].pill}`}>
            {tally(s)} {LOOK[s].label.toLowerCase()}
          </span>
        ))}
      </p>

      {[
        { title: "WhatsApp", rows: whatsapp },
        { title: "Customer payments", rows: customerPayments },
        { title: "Platform", rows: platform },
      ].map((group) => (
        <section key={group.title} className="mb-6" aria-label={group.title}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.title}</h2>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {group.rows.map((r) => {
              const look = LOOK[r.state];
              const Icon = look.icon;
              return (
                <li key={r.key} className="flex gap-3 p-4">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${look.row}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{r.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${look.pill}`}>{look.label}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-neutral-700">{r.summary}</p>
                    {r.fix && <p className="mt-1 break-words text-xs leading-relaxed text-neutral-500">Fix: {r.fix}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
