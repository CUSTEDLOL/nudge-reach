import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import {
  AUDIT_RESULTS,
  auditList,
  type AuditFilter,
} from "@/modules/admin/audit-log";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AuditTable } from "@/components/features/admin-shell/audit-table";

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";
const inputCls =
  "h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200";

type AuditSearchParams = {
  cursor?: string | string[];
  orgId?: string | string[];
  actor?: string | string[];
  action?: string | string[];
  result?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
};

/** Platform-wide audit trail with founder-focused incident filters and export. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const orgId = one(sp.orgId);
  const actor = one(sp.actor);
  const action = one(sp.action);
  const requestedResult = one(sp.result);
  const result = AUDIT_RESULTS.find((candidate) => candidate === requestedResult) ?? "all";
  const dateFrom = one(sp.dateFrom);
  const dateTo = one(sp.dateTo);
  const activeParams = {
    ...(orgId ? { orgId } : {}),
    ...(actor ? { actor } : {}),
    ...(action ? { action } : {}),
    ...(result !== "all" ? { result } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };
  const filter: AuditFilter = {
    orgId: orgId || undefined,
    actor: actor || undefined,
    action: action || undefined,
    result,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    cursor: one(sp.cursor) || undefined,
  };
  const { rows, nextCursor } = await auditList(filter);
  const filtered = Object.keys(activeParams).length > 0;
  const exportHref = `/admin/audit/export${filtered ? `?${new URLSearchParams(activeParams)}` : ""}`;
  const olderHref = nextCursor
    ? `/admin/audit?${new URLSearchParams({ ...activeParams, cursor: nextCursor })}`
    : null;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Trace who changed what, when it happened, and whether the operation completed."
        actions={
          <Link
            href={exportHref}
            className="inline-flex h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Export CSV
          </Link>
        }
      />

      <form method="get" className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 lg:grid-cols-12">
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">Organisation ID</span>
          <input
            name="orgId"
            defaultValue={orgId}
            placeholder="Exact workspace ID"
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">Actor</span>
          <input
            name="actor"
            defaultValue={actor}
            placeholder="founder: or an email"
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">Action</span>
          <select name="action" defaultValue={action} className={`${inputCls} w-full`}>
            <option value="">Any action</option>
            <option value="admin.">Nudge support</option>
            <option value="member.">Team</option>
            <option value="billing.">Billing</option>
            <option value="whatsapp.">WhatsApp</option>
            <option value="calendar.">Calendar</option>
            <option value="contact.">Contacts</option>
            <option value="campaign.">Campaigns</option>
            <option value="knowledge.">Knowledge</option>
            <option value="api_key.">API keys</option>
            <option value="webhook.">Webhooks</option>
            <option value="llm.">Own LLM</option>
            <option value="voice.">Voice</option>
          </select>
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">Result</span>
          <select name="result" defaultValue={result} className={`${inputCls} w-full`}>
            <option value="all">Any result</option>
            <option value="requested">Requested</option>
            <option value="failed">Failed</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">From</span>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className={`${inputCls} w-full`} />
        </label>
        <label className="lg:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">To</span>
          <input type="date" name="dateTo" defaultValue={dateTo} className={`${inputCls} w-full`} />
        </label>
        <div className="flex items-end gap-3 lg:col-span-6">
          <button
            type="submit"
            className="h-11 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Apply filters
          </button>
          {filtered && (
            <Link
              href="/admin/audit"
              className="inline-flex h-11 items-center rounded-lg px-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Clear
            </Link>
          )}
        </div>
        <p className="text-xs text-neutral-500 lg:col-span-12">
          Use global organisation search to copy a workspace ID. Exports contain at most 10,000 matching entries.
        </p>
      </form>

      <Card className="mt-4">
        <CardContent className="p-0">
          <AuditTable rows={rows} showOrg />
          {olderHref && (
            <div className="border-t border-neutral-100 px-5 py-3">
              <Link
                href={olderHref}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                Older entries
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
