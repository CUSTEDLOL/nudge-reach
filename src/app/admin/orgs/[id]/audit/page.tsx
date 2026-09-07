import Link from "next/link";
import { requireFounder } from "@/modules/admin/auth";
import { auditList } from "@/modules/admin/audit-log";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditTable } from "@/components/features/admin-shell/audit-table";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Everything anyone did in this workspace; founder rows are highlighted. */
export default async function AdminOrgAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string | string[]; who?: string | string[] }>;
}) {
  await requireFounder();
  const { id } = await params;
  const sp = await searchParams;
  const who = one(sp.who);
  const { rows, nextCursor } = await auditList({
    orgId: id,
    cursor: one(sp.cursor) || undefined,
    actor: who === "founders" ? "founder:" : undefined,
  });
  const base = `/admin/orgs/${id}/audit`;
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Newest first. Rows in amber are Nudge support actions.</CardDescription>
        </div>
        <nav className="flex gap-1">
          <Link href={base} className={pill(who !== "founders")}>
            Everyone
          </Link>
          <Link href={`${base}?who=founders`} className={pill(who === "founders")}>
            Nudge support
          </Link>
        </nav>
      </CardHeader>
      <CardContent className="p-0">
        <AuditTable rows={rows} showOrg={false} />
        {nextCursor && (
          <div className="border-t border-neutral-100 px-5 py-3">
            <Link
              href={`${base}?${new URLSearchParams({ ...(who ? { who } : {}), cursor: nextCursor })}`}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Older →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
