import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFounder } from "@/modules/admin/auth";
import { orgDetail } from "@/modules/admin/org-detail";
import { getConciergeStatus } from "@/modules/concierge";
import { formatMicroUsd } from "@/modules/analytics/compute";
import { getPlan } from "@/modules/billing/plans";
import { trialDaysLeft } from "@/modules/billing/trial";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import { setFounderNotesAction } from "./actions";

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-neutral-300"}`}
        aria-hidden
      />
      <span className={ok ? "text-neutral-900" : "text-neutral-500"}>{label}</span>
    </li>
  );
}

/** Org overview: the snapshot a founder needs before touching anything. */
export default async function AdminOrgOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const { id } = await params;
  const [detail, concierge, notesRow] = await Promise.all([
    orgDetail(id),
    getConciergeStatus(id),
    prisma.org.findUnique({ where: { id }, select: { founderNotes: true, trialEndsAt: true } }),
  ]);
  if (!detail || !notesRow) notFound();
  const { org } = detail;
  const plan = getPlan(org.plan);
  const trialLeft = trialDaysLeft(notesRow.trialEndsAt);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contacts" value={org._count.contacts.toLocaleString()} />
        <StatCard label="Conversations" value={org._count.conversations.toLocaleString()} />
        <StatCard
          label="AI cost · 30d"
          value={formatMicroUsd(detail.aiCostMicroUsd30d)}
          hint={`${detail.aiCalls30d.toLocaleString()} calls`}
        />
        <StatCard
          label="Bookings · payments"
          value={`${org._count.bookingRequests} · ${org._count.paymentRequests}`}
          hint="all time"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plan &amp; billing</CardTitle>
            <CardDescription>What this org is entitled to and whether it pays.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">Plan</dt>
              <dd className="font-medium">{plan.name}</dd>
              <dt className="text-neutral-500">Subscription</dt>
              <dd className="font-medium capitalize">{org.subscriptionStatus.replace("_", " ")}</dd>
              <dt className="text-neutral-500">Trial</dt>
              <dd className="font-medium">
                {trialLeft === null ? "none" : trialLeft === 0 ? "ended" : `${trialLeft} days left`}
              </dd>
              <dt className="text-neutral-500">Timezone · currency</dt>
              <dd className="font-medium">
                {org.timezone} · {org.currency}
              </dd>
            </dl>
            <Link
              href={`/admin/orgs/${org.id}/controls`}
              className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Change plan, trial, mode or access →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Go-live readiness
              <Badge tone={concierge.ready ? "success" : "warning"}>
                {concierge.ready ? "Ready" : "Not ready"}
              </Badge>
            </CardTitle>
            <CardDescription>Computed from real state, the same checklist the client sees.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              <Check ok={concierge.agentConfigured} label="Knowledge base has content" />
              <Check ok={concierge.agentEnabled} label="AI Front Desk switched on" />
              <Check ok={concierge.calendarConnected} label="Calendar connected" />
              <Check ok={concierge.approvedTemplates > 0} label={`Approved templates (${concierge.approvedTemplates})`} />
              <Check ok={concierge.followUpEnabled} label="Follow-ups enabled" />
              <Check ok={org.whatsappAccounts.length > 0} label={`WhatsApp number connected (${org.whatsappAccounts.length})`} />
            </ul>
            <Link
              href={`/admin/orgs/${org.id}/agent`}
              className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Run concierge setup →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team ({org.memberships.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {org.memberships.slice(0, 6).map((m) => (
                <li key={`${m.email}-${m.role}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{m.displayName || m.email || "(no email on record)"}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {m.email && `${m.email} · `}
                    <span className="capitalize">{m.role.toLowerCase()}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`/admin/orgs/${org.id}/team`} className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
              Manage team →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest contact events. No message content, by design.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs">
              {detail.events.slice(0, 8).map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="font-mono">{e.type}</span>
                  <span className="text-neutral-500">
                    {e.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </li>
              ))}
              {detail.events.length === 0 && <li className="text-neutral-400">No events yet.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
            <CardDescription>Founder-only. The client never sees this.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={setFounderNotesAction} hidden={{ orgId: org.id }} submitLabel="Save notes" className="space-y-2">
              <textarea
                name="notes"
                defaultValue={notesRow.founderNotes ?? ""}
                rows={4}
                placeholder="Deal terms, who the decision-maker is, what they asked for on the onboarding call…"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
