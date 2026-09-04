import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { overviewStats } from "@/modules/admin/queries";
import { formatMicroUsd, parseRange } from "@/modules/analytics/compute";

const RANGES = [7, 30, 90] as const;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireFounder();
  const days = parseRange((await searchParams).days);
  const s = await overviewStats(days);
  const maxSignups = Math.max(1, ...s.signupsByDay.map((d) => d.count));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overview</h1>
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
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Workspaces" value={String(s.orgsTotal)} hint={`${s.liveOrgs} live · ${s.testOrgs} test`} />
        <Stat label={`Signups (${days}d)`} value={String(s.signupsInRange)} />
        <Stat label={`Active orgs (${days}d)`} value={String(s.activeOrgs)} hint="received a message" />
        <Stat
          label={`AI cost (${days}d)`}
          value={formatMicroUsd(s.aiCostMicroUsd)}
          hint={s.aiCostByokMicroUsd > 0 ? `${formatMicroUsd(s.aiCostByokMicroUsd)} customer-paid (BYOK)` : "all platform-paid"}
        />
        <Stat label="Messages in" value={s.messagesInbound.toLocaleString()} />
        <Stat label="Messages out" value={s.messagesOutbound.toLocaleString()} />
        <Stat label={`Bookings (${days}d)`} value={String(s.bookings)} />
        <Stat label={`Payments paid (${days}d)`} value={String(s.paymentsPaid)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Orgs by plan</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {s.orgsByPlan.map((row) => (
                <tr key={row.plan} className="border-t border-neutral-100">
                  <td className="py-1.5 font-medium capitalize">{row.plan}</td>
                  <td className="py-1.5 text-right tabular-nums">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Signups per day</h2>
          <div className="mt-3 flex h-32 items-end gap-px" aria-label="Signups per day">
            {s.signupsByDay.map((d) => (
              <div
                key={d.label}
                title={`${d.label}: ${d.count}`}
                className="flex-1 rounded-t bg-emerald-500/80"
                style={{ height: `${(d.count / maxSignups) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            {s.signupsByDay[0]?.label} → {s.signupsByDay.at(-1)?.label}
          </p>
        </section>
      </div>
    </div>
  );
}
