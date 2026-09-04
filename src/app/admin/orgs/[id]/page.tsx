import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFounder } from "@/modules/admin/auth";
import { orgDetail } from "@/modules/admin/org-detail";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { PLANS } from "@/modules/billing/plans";
import { SetPlanForm } from "./set-plan-form";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFounder();
  const { id } = await params;
  const detail = await orgDetail(id);
  if (!detail) notFound();
  const { org, templates, events, audit } = detail;

  return (
    <div>
      <Link href="/admin/orgs" className="text-sm text-neutral-500 hover:underline">
        ← All orgs
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{org.name}</h1>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${org.simulated ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
        >
          {org.simulated ? "test mode" : "live"}
        </span>
        <span className="text-xs text-neutral-500">
          {org.vertical ?? "no vertical"} · {org.currency} · created{" "}
          {org.createdAt.toLocaleDateString("en-GB")}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title="Plan & billing">
          <p className="text-sm">
            Plan: <span className="font-medium capitalize">{org.plan}</span> · subscription{" "}
            {org.subscriptionStatus}
          </p>
          <SetPlanForm
            orgId={org.id}
            currentPlan={org.plan}
            planIds={PLANS.map((p) => p.id)}
          />
        </Section>

        <Section title={`Usage (30d) — ${formatMicroUsd(detail.aiCostMicroUsd30d)} AI cost`}>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            <li>{org._count.contacts} contacts</li>
            <li>{org._count.conversations} conversations</li>
            <li>{detail.aiCalls30d} AI calls (30d)</li>
            <li>{org._count.knowledgeEntries} knowledge facts</li>
            <li>{org._count.bookingRequests} bookings</li>
            <li>{org._count.paymentRequests} payment links</li>
            <li>{detail.pendingQuestions} owner questions pending</li>
            <li>
              Agent: {org.agentProfile?.enabled ? "on" : "off"} (
              {org.agentProfile?.vertical ?? "—"}) · follow-ups{" "}
              {org.followUpConfig?.enabled ? "on" : "off"}
            </li>
          </ul>
        </Section>

        <Section title={`Team (${org.memberships.length})`}>
          <ul className="space-y-1 text-sm">
            {org.memberships.map((m) => (
              <li key={m.email} className="flex justify-between">
                <span>{m.displayName || m.email}</span>
                <span className="text-xs text-neutral-500">
                  {m.email} · {m.role}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={`WhatsApp numbers (${org.whatsappAccounts.length})`}>
          {org.whatsappAccounts.length === 0 ? (
            <p className="text-sm text-neutral-400">None connected (test mode).</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {org.whatsappAccounts.map((a) => (
                <li key={a.phoneNumberId} className="flex justify-between">
                  <span>
                    {a.displayName} {a.isDefault && <span className="text-xs text-emerald-700">· default</span>}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {a.phoneNumberId} · {a.status}
                    {a.qualityRating ? ` · ${a.qualityRating}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Library templates (${templates.length})`}>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {templates.map((t) => (
              <li key={t.name} className="flex justify-between gap-2">
                <span className="truncate font-mono text-xs">{t.name}</span>
                <span
                  className={`text-xs ${t.metaStatus === "APPROVED" ? "text-emerald-700" : t.metaStatus === "REJECTED" ? "text-red-600" : "text-amber-700"}`}
                  title={t.rejectionReason ?? undefined}
                >
                  {t.metaStatus}
                </span>
              </li>
            ))}
            {templates.length === 0 && <li className="text-neutral-400">None.</li>}
          </ul>
        </Section>

        <Section title="Recent events">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {events.map((e, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="font-mono">{e.type}</span>
                <span className="text-neutral-500">
                  {e.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
            {events.length === 0 && <li className="text-neutral-400">No events yet.</li>}
          </ul>
        </Section>

        <Section title="Recent audit log">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {audit.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{a.action}</span>
                {a.detail ? ` — ${a.detail}` : ""}{" "}
                <span className="text-neutral-500">
                  by {a.actorName},{" "}
                  {a.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
            {audit.length === 0 && <li className="text-neutral-400">Empty.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
