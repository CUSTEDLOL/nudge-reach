import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { opsOverview } from "@/modules/admin/ops";
import { formatMicroUsd } from "@/modules/analytics/compute";

function ago(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / (24 * 60))}d ago`;
}

export default async function AdminOpsPage() {
  await requireFounder();
  const ops = await opsOverview();
  const healthy =
    ops.webhookFailures.length === 0 &&
    ops.stuckTemplates.length === 0 &&
    ops.costAlerts.length === 0;

  return (
    <div>
      <h1 className="text-xl font-semibold">Ops</h1>
      {healthy && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          All clear — no webhook failures (7d), no stuck templates, no cost alerts.
        </p>
      )}

      <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Heartbeats</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
          <li>Last automation run: {ago(ops.lastActivity.automationRunAt)}</li>
          <li>Last outbound message: {ago(ops.lastActivity.outboundMessageAt)}</li>
          <li>Last AI call: {ago(ops.lastActivity.aiCallAt)}</li>
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">
          AI cost alerts — over 35% of plan price (30d)
        </h2>
        {ops.costAlerts.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {ops.costAlerts.map((a) => (
              <li key={a.orgId} className="flex justify-between">
                <Link href={`/admin/orgs/${a.orgId}`} className="font-medium hover:underline">
                  {a.orgName}
                </Link>
                <span className="tabular-nums text-amber-700">
                  {formatMicroUsd(a.costMicroUsd30d)} · {a.pctOfPlan}% of {a.plan}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Stuck / rejected templates</h2>
        {ops.stuckTemplates.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {ops.stuckTemplates.map((t, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  <Link href={`/admin/orgs/${t.org.id}`} className="hover:underline">
                    {t.org.name}
                  </Link>{" "}
                  · <span className="font-mono text-xs">{t.name}</span>
                </span>
                <span
                  className={`text-xs ${t.metaStatus === "REJECTED" ? "text-red-600" : "text-amber-700"}`}
                  title={t.rejectionReason ?? undefined}
                >
                  {t.metaStatus === "REJECTED" ? "rejected" : "pending > 24h"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Webhook delivery failures (7d)</h2>
        {ops.webhookFailures.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">None.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {ops.webhookFailures.map((w, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  <Link href={`/admin/orgs/${w.endpoint.org.id}`} className="hover:underline">
                    {w.endpoint.org.name}
                  </Link>{" "}
                  · {w.event} → <span className="font-mono">{w.endpoint.url}</span>
                </span>
                <span className="text-red-600">
                  {w.status ?? "no response"}
                  {w.error ? ` · ${w.error.slice(0, 60)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
