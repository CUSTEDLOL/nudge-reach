import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { orgUsage } from "@/modules/admin/usage";
import { formatMicroUsd, parseRange } from "@/modules/analytics/compute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

const RANGES = [7, 30, 90] as const;

function Bars({ series, label, format }: { series: { label: string; count: number }[]; label: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...series.map((d) => d.count));
  return (
    <div>
      <div className="flex h-28 items-end gap-px" aria-label={label}>
        {series.map((d) => (
          <div
            key={d.label}
            title={`${d.label}: ${format ? format(d.count) : d.count}`}
            className="flex-1 rounded-t bg-emerald-500/80"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {series[0]?.label} → {series.at(-1)?.label}
      </p>
    </div>
  );
}

/** Cost side (AI, voice) and value side (messages, bookings, payments) for one org. */
export default async function AdminOrgUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  await requireFounder();
  const { id } = await params;
  const days = parseRange((await searchParams).days);
  const u = await orgUsage(id, days);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Last {days} days</p>
        <nav className="flex gap-1 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/orgs/${id}/usage?days=${r}`}
              className={`rounded-lg px-3 py-1 ${r === days ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              {r}d
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="AI cost"
          value={formatMicroUsd(u.aiCostMicroUsd)}
          hint={u.aiCostByokMicroUsd > 0 ? `${formatMicroUsd(u.aiCostByokMicroUsd)} customer-paid` : `${u.aiCalls.toLocaleString()} calls · platform-paid`}
        />
        <StatCard label="Messages" value={`${u.messagesIn.toLocaleString()} in · ${u.messagesOut.toLocaleString()} out`} />
        <StatCard label="Bookings · payments paid" value={`${u.bookings} · ${u.paymentsPaid}`} hint={`${u.paymentsRequested} payment links sent`} />
        <StatCard
          label="Voice"
          value={`${u.voiceCalls} calls`}
          hint={u.voiceMinutesIncluded === null ? `${u.voiceMinutesUsed} min this month · unlimited` : `${u.voiceMinutesUsed} / ${u.voiceMinutesIncluded} min this month`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI cost per day</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars series={u.aiCostByDay} label="AI cost per day" format={formatMicroUsd} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Messages per day</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars series={u.messagesByDay} label="Messages per day" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI spend by purpose</CardTitle>
            <CardDescription>Where the model budget goes for this org.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {u.aiByPurpose.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-400">No AI calls in this window.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {u.aiByPurpose.map((p) => (
                    <tr key={p.purpose} className="border-t border-neutral-100">
                      <td className="px-5 py-2 font-mono text-xs">{p.purpose}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{p.calls.toLocaleString()}</td>
                      <td className="px-5 py-2 text-right tabular-nums">{formatMicroUsd(p.costMicroUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
            <CardDescription>All time. Marketing only ever reaches the opted-in count.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">Contacts</dt>
              <dd className="font-medium tabular-nums">{u.contacts.toLocaleString()}</dd>
              <dt className="text-neutral-500">Opted in to marketing</dt>
              <dd className="font-medium tabular-nums">{u.optedIn.toLocaleString()}</dd>
              <dt className="text-neutral-500">Opted out</dt>
              <dd className="font-medium tabular-nums">{u.optedOut.toLocaleString()}</dd>
              <dt className="text-neutral-500">Conversations</dt>
              <dd className="font-medium tabular-nums">{u.conversations.toLocaleString()}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
