import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { auditList } from "@/modules/admin/audit-log";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AuditTable } from "@/components/features/admin-shell/audit-table";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const inputCls =
  "h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500";

/** Platform-wide audit trail with the filters a founder actually uses. */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string | string[]; actor?: string | string[]; action?: string | string[] }>;
}) {
  await requireFounder();
  const sp = await searchParams;
  const actor = one(sp.actor);
  const action = one(sp.action);
  const { rows, nextCursor } = await auditList({
    actor: actor || undefined,
    action: action || undefined,
    cursor: one(sp.cursor) || undefined,
  });
  const qs = (extra: Record<string, string>) =>
    `/admin/audit?${new URLSearchParams({ ...(actor ? { actor } : {}), ...(action ? { action } : {}), ...extra })}`;

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every audited action across every workspace. Founder actions are written as founder:<email> and shown in amber."
      />
      <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
        <input name="actor" defaultValue={actor} placeholder="Who (e.g. founder: or an email)" className={`${inputCls} w-64`} aria-label="Actor filter" />
        <select name="action" defaultValue={action} className={inputCls} aria-label="Action filter">
          <option value="">Any action</option>
          <option value="admin.">Nudge support (admin.*)</option>
          <option value="member.">Team (member.*)</option>
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
        <button type="submit" className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white">
          Filter
        </button>
        {(actor || action) && (
          <Link href="/admin/audit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Clear
          </Link>
        )}
      </form>
      <Card className="mt-4">
        <CardContent className="p-0">
          <AuditTable rows={rows} showOrg />
          {nextCursor && (
            <div className="border-t border-neutral-100 px-5 py-3">
              <Link href={qs({ cursor: nextCursor })} className="text-sm font-medium text-brand-700 hover:underline">
                Older →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
