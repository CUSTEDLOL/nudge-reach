import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { revenueOverview } from "@/modules/admin/revenue";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { getPlan } from "@/modules/billing/plans";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const day = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

function OrgLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/orgs/${id}`} className="font-medium hover:underline">
      {name}
    </Link>
  );
}

/** Book-value MRR, and every list a founder should act on this week. */
export default async function AdminRevenuePage() {
  await requireFounder();
  const r = await revenueOverview();
  const lead = r.mrrByCurrency[0];

  return (
    <div>
      <PageHeader
        title="Revenue"
        description="MRR is book value: each active subscription at its plan's list price in the org's own currency. Cash collected lives in Razorpay / Stripe."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active subscriptions" value={String(r.activeSubscriptions)} />
        <StatCard
          label={lead ? `MRR · ${lead.currency}` : "MRR"}
          value={lead ? money(lead.monthly, lead.currency) : "—"}
          hint={
            r.mrrByCurrency.length > 1
              ? r.mrrByCurrency.slice(1).map((c) => `${money(c.monthly, c.currency)} ${c.currency}`).join(" · ")
              : lead
                ? `${lead.orgs} org${lead.orgs === 1 ? "" : "s"}`
                : "no active subscriptions"
          }
        />
        <StatCard label="Trials ending in 7d" value={String(r.trialsExpiring.length)} hint={`${r.trialsExpired} already ended, not converted`} />
        <StatCard label="Past due" value={String(r.pastDue.length)} hint={`${r.cancelled} cancelled`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>MRR by plan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {r.mrr.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">No active subscriptions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 text-right font-medium">Orgs</th>
                    <th className="px-5 py-2 text-right font-medium">Monthly</th>
                  </tr>
                </thead>
                <tbody>
                  {r.mrr.map((row) => (
                    <tr key={`${row.currency}-${row.plan}`} className="border-t border-neutral-100">
                      <td className="px-5 py-2">
                        {row.planName} <span className="text-xs text-neutral-400">{row.currency}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.orgs}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{money(row.monthly, row.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trials ending this week</CardTitle>
            <CardDescription>Call them before the cron drops them to Free.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {r.trialsExpiring.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">None in the next 7 days.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {r.trialsExpiring.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <div className="min-w-0">
                      <OrgLink id={t.id} name={t.name} />
                      <p className="truncate text-xs text-neutral-500">{t.ownerEmail || "no owner email"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge tone="warning">ends {day(t.trialEndsAt)}</Badge>
                      <p className="mt-0.5 text-xs text-neutral-500">{getPlan(t.plan).name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Past due</CardTitle>
            <CardDescription>Payment failed or lapsed. Chase, or mark cancelled from Controls.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {r.pastDue.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">Nobody is past due.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {r.pastDue.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <OrgLink id={o.id} name={o.name} />
                    <span className="text-xs text-neutral-500">
                      {getPlan(o.plan).name} · {o.currency} · period ended {day(o.currentPeriodEnd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live but quiet</CardTitle>
            <CardDescription>Live workspaces with no inbound message in 14 days — churn risk.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {r.quietLiveOrgs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">Every live workspace heard from a customer recently.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {r.quietLiveOrgs.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <OrgLink id={o.id} name={o.name} />
                    <span className="text-xs text-neutral-500">
                      {getPlan(o.plan).name} · last inbound {o.lastInboundAt ? day(o.lastInboundAt) : "never"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI cost alerts</CardTitle>
            <CardDescription>Platform-paid AI spend in the last 30 days above the alert share of the plan price.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {r.costAlerts.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">No org is over its alert threshold.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {r.costAlerts.map((a) => (
                  <li key={a.orgId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <OrgLink id={a.orgId} name={a.orgName} />
                    <span className="text-xs text-neutral-500">
                      {formatMicroUsd(a.costMicroUsd30d)} · {Math.round(a.pctOfPlan)}% of {getPlan(a.plan).name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
