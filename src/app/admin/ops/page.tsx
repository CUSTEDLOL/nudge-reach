import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  CircleX,
  Clock3,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { requireFounder } from "@/modules/admin/auth";
import type { HealthSeverity } from "@/modules/admin/health";
import { opsOverview } from "@/modules/admin/ops";

const STATE: Record<
  HealthSeverity,
  { label: string; summary: string; icon: LucideIcon; className: string }
> = {
  healthy: {
    label: "Healthy",
    summary: "The queue worker is current and no active incidents were found.",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  degraded: {
    label: "Degraded",
    summary: "The platform is running, but one or more conditions need attention.",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-950",
  },
  critical: {
    label: "Critical",
    summary: "Delivery or integration work is failing. Review the incidents below.",
    icon: CircleX,
    className: "border-red-200 bg-red-50 text-red-950",
  },
  unknown: {
    label: "Unknown",
    summary: "No queue heartbeat exists yet. Run or deploy the scheduled worker to establish health.",
    icon: CircleHelp,
    className: "border-neutral-300 bg-neutral-100 text-neutral-900",
  },
};

function ago(value: Date | null): string {
  if (!value) return "Never recorded";
  const minutes = Math.max(0, Math.round((Date.now() - value.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (24 * 60))}d ago`;
}

function heartbeatStep(detail: unknown): string | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const step = (detail as Record<string, unknown>).step;
  return typeof step === "string" ? step.slice(0, 64) : null;
}

function Empty() {
  return <p className="mt-3 text-sm text-neutral-400">None.</p>;
}

export default async function AdminOpsPage() {
  await requireFounder();
  const ops = await opsOverview();
  const state = STATE[ops.severity];
  const StateIcon = state.icon;
  const failedStep = ops.heartbeat.status === "error" ? heartbeatStep(ops.heartbeat.detail) : null;

  return (
    <div>
      <PageHeader
        title="Operations"
        description="A privacy-safe view of delivery, integrations, templates, and platform cost."
      />

      <section className={`rounded-xl border p-4 sm:p-5 ${state.className}`} aria-labelledby="platform-state">
        <div className="flex items-start gap-3">
          <StateIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="platform-state" className="font-semibold">Platform state: {state.label}</h2>
              <Badge tone={ops.severity === "healthy" ? "success" : ops.severity === "critical" ? "danger" : ops.severity === "degraded" ? "warning" : "neutral"}>
                {state.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm opacity-80">{state.summary}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs font-medium opacity-75">
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden /> Queue heartbeat {ago(ops.heartbeat.lastSeenAt)}</span>
              <span>· Freshness: {ops.heartbeat.freshness}</span>
              {failedStep && <span>· Failed step: {failedStep}</span>}
            </p>
          </div>
        </div>
      </section>

      <dl className="mt-4 grid overflow-hidden rounded-xl border border-neutral-200 bg-white sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Queued >15m", ops.incidentCounts.staleQueued],
          ["Failed messages", ops.incidentCounts.failedMessages],
          ["Dead CRM jobs", ops.incidentCounts.deadCrmJobs],
          ["Webhook failures", ops.incidentCounts.webhookFailures],
          ["Template issues", ops.incidentCounts.stuckTemplates],
          ["Cost alerts", ops.incidentCounts.costAlerts],
        ].map(([label, count]) => (
          <div key={label} className="border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className={`mt-1 text-lg font-semibold tabular-nums ${Number(count) > 0 ? "text-neutral-900" : "text-neutral-400"}`}>{count}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Campaign delivery</h2>
          <p className="text-xs text-neutral-500">Grouped by campaign and workspace</p>
        </div>
        {ops.queuedCampaigns.length === 0 && ops.failedCampaigns.length === 0 ? (
          <Empty />
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100">
            {ops.queuedCampaigns.map((row) => (
              <li key={`queued-${row.campaignId}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{row.campaignName} <Badge tone="warning">Queued &gt;15m</Badge></p>
                  <p className="mt-1 text-xs text-neutral-500">{row.orgName} · {row.count} messages · oldest {ago(row.oldestAt)}</p>
                </div>
                <Link href={`/admin/orgs/${row.orgId}`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                  Check workspace <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
            {ops.failedCampaigns.map((row) => (
              <li key={`failed-${row.campaignId}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{row.campaignName} <Badge tone="danger">Failed sends</Badge></p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {row.orgName} · {row.count} messages · latest {ago(row.latestAt)} · {row.retryEligible ? "Consent-safe retry path available" : "Review workspace state first"}
                  </p>
                </div>
                <Link href={`/admin/orgs/${row.orgId}`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50">
                  Review incident <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">CRM sync jobs requiring intervention</h2>
        {ops.deadCrmJobs.length === 0 ? <Empty /> : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {ops.deadCrmJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium">{job.org.name} <Badge tone="danger">Dead job</Badge></p>
                  <p className="mt-1 text-xs text-neutral-500">{job.provider} · {job.event} · {job.attempts} attempts · last tried {ago(job.updatedAt)}</p>
                </div>
                <Link href={`/admin/orgs/${job.orgId}/integrations`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-neutral-200 px-3 font-medium hover:bg-neutral-50">
                  Check integration <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Template approval issues</h2>
          {ops.stuckTemplates.length === 0 ? <Empty /> : (
            <ul className="mt-3 divide-y divide-neutral-100 text-sm">
              {ops.stuckTemplates.map((template) => (
                <li key={template.id} className="flex justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span><Link href={`/admin/orgs/${template.org.id}`} className="font-medium hover:underline">{template.org.name}</Link> · <span className="font-mono text-xs">{template.name}</span></span>
                  <Badge tone={template.metaStatus === "REJECTED" ? "danger" : "warning"} title={template.rejectionReason ?? undefined}>
                    {template.metaStatus === "REJECTED" ? "Rejected" : "Pending >24h"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Webhook delivery failures · 7d</h2>
          {ops.webhookFailures.length === 0 ? <Empty /> : (
            <ul className="mt-3 divide-y divide-neutral-100 text-sm">
              {ops.webhookFailures.map((failure) => (
                <li key={failure.id} className="flex justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0"><Link href={`/admin/orgs/${failure.endpoint.org.id}/integrations`} className="font-medium hover:underline">{failure.endpoint.org.name}</Link><span className="block truncate text-xs text-neutral-500">{failure.event} → {failure.endpoint.url}</span></span>
                  <Badge tone="danger">{failure.status ?? "No response"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold">AI cost alerts · 30d</h2>
        <p className="mt-1 text-xs text-neutral-500">Workspaces over 35% of their plan price.</p>
        {ops.costAlerts.length === 0 ? <Empty /> : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {ops.costAlerts.map((alert) => (
              <li key={alert.orgId} className="flex flex-wrap justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <Link href={`/admin/orgs/${alert.orgId}/usage`} className="font-medium hover:underline">{alert.orgName}</Link>
                <span className="tabular-nums text-amber-800">{formatMicroUsd(alert.costMicroUsd30d)} · {alert.pctOfPlan}% of {alert.plan}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 border-t border-neutral-200 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent activity metadata</h2>
        <p className="mt-1 text-xs text-neutral-400">These timestamps provide context; only the queue heartbeat above determines worker freshness.</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-neutral-500">Automation created</dt><dd className="mt-0.5">{ago(ops.lastActivity.automationRunAt)}</dd></div>
          <div><dt className="text-xs text-neutral-500">Outbound message</dt><dd className="mt-0.5">{ago(ops.lastActivity.outboundMessageAt)}</dd></div>
          <div><dt className="text-xs text-neutral-500">AI call</dt><dd className="mt-0.5">{ago(ops.lastActivity.aiCallAt)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
