import { requireFounder } from "@/modules/admin/auth";
import {
  AUDIT_RESULTS,
  auditExportRows,
  serializeAuditCsv,
  type AuditFilter,
} from "@/modules/admin/audit-log";

export const dynamic = "force-dynamic";

const value = (params: URLSearchParams, key: string) => params.get(key)?.trim() || undefined;

/** Founder-only export with the exact same filters as the on-screen audit log. */
export async function GET(request: Request) {
  await requireFounder();

  const params = new URL(request.url).searchParams;
  const requestedResult = value(params, "result");
  const result = AUDIT_RESULTS.find((candidate) => candidate === requestedResult);
  const filter: AuditFilter = {
    orgId: value(params, "orgId"),
    actor: value(params, "actor"),
    action: value(params, "action"),
    result,
    dateFrom: value(params, "dateFrom"),
    dateTo: value(params, "dateTo"),
  };
  const rows = await auditExportRows(filter);
  const filenameDate = new Date().toISOString().slice(0, 10);

  return new Response(serializeAuditCsv(rows), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="nudge-admin-audit-${filenameDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
