import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { overviewStats } from "@/modules/admin/queries";
import { leadCounts } from "@/modules/admin/leads";
import { revenueOverview } from "@/modules/admin/revenue";
import { formatMicroUsd, parseRange } from "@/modules/analytics/compute";
import { getPlan } from "@/modules/billing/plans";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const RANGES = [7, 30, 90] as const;

function Attention({ count, label, href, tone }: { count: number; label: string; href: string; tone: "warn" | "bad" | "ok" }) {
  const color =
    count === 0
      ? "border-neutral-200 bg-white text-neutral-500"
      : tone === "bad"
        ? "border-red-200 bg-red-50 text-red-800"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <Link href={href} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${color} hover:opacity-90`}>
      <span>{label}</span>
      <span className="text-lg font-semibold tabular-nums">{count}</span>
    </Link>
  );
}

/** The founders' home: what needs attention this week, then the platform pulse. */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireFounder();
  const days = parseRange((await searchParams).days);
  const [s, leads, rev] = await Promise.all([overviewStats(days), leadCounts(), revenueOverview()]);
  const maxSignups = Math.max(1, ...s.signupsByDay.map((d) => d.count));
  const mrr = rev.mrrByCurrency[0];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Needs attention first, then the platform over the selected window."
        actions={
          <nav className="flex gap-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/admin?days=${r}`}
                className={`rounded-lg px-3 py-1 ${r === days ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
              >
                {r}d
              </Link>
            ))}
          </nav>
        }
      />

      <section aria-label="Needs attention" className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Attention count={leads.byStatus.new} label="New leads to call" href="/admin/leads" tone="ok" />
        <Attention count={rev.trialsExpiring.length} label="Trials ending in 7 days" href="/admin/revenue" tone="warn" />
        <Attention count={rev.pastDue.length} label="Past due" href="/admin/revenue" tone="bad" />
        <Attention count={rev.quietLiveOrgs.length} label="Live but quiet (14d)" href="/admin/revenue" tone="warn" />
        <Attention count={rev.costAlerts.length} label="AI cost alerts" href="/admin/ops" tone="bad" />
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Workspaces" value={String(s.orgsTotal)} hint={`${s.liveOrgs} live · ${s.testOrgs} test`} />
        <StatCard label="Paying" value={String(rev.activeSubscriptions)} hint={mrr ? `${new Intl.NumberFormat("en", { style: "currency", currency: mrr.currency, maximumFractionDigits: 0 }).format(mrr.monthly)} MRR` : "no MRR yet"} />
        <StatCard label={`Signups · ${days}d`} value={String(s.signupsInRange)} />
        <StatCard label={`Active orgs · ${days}d`} value={String(s.activeOrgs)} hint="received a message" />
        <StatCard
          label={`AI cost · ${days}d`}
          value={formatMicroUsd(s.aiCostMicroUsd)}
          hint={s.aiCostByokMicroUsd > 0 ? `${formatMicroUsd(s.aiCostByokMicroUsd)} customer-paid` : "all platform-paid"}
        />
        <StatCard label={`Messages · ${days}d`} value={`${s.messagesInbound.toLocaleString()} in · ${s.messagesOutbound.toLocaleString()} out`} />
        <StatCard label={`Bookings · ${days}d`} value={String(s.bookings)} />
        <StatCard label={`Payments paid · ${days}d`} value={String(s.paymentsPaid)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspaces by plan</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {s.orgsByPlan.map((row) => (
                  <tr key={row.plan} className="border-t border-neutral-100">
                    <td className="px-5 py-2">
                      <Link href={`/admin/orgs?plan=${row.plan}`} className="font-medium hover:underline">
                        {getPlan(row.plan).name}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Signups per day</CardTitle>
            <CardDescription>
              {s.signupsByDay[0]?.label} → {s.signupsByDay.at(-1)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-px" aria-label="Signups per day">
              {s.signupsByDay.map((d) => (
                <div
                  key={d.label}
                  title={`${d.label}: ${d.count}`}
                  className="flex-1 rounded-t bg-emerald-500/80"
                  style={{ height: `${(d.count / maxSignups) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
