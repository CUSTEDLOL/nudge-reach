import Link from "next/link";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/modules/orgs/audit";
import type { AuditRow } from "@/modules/admin/audit-log";

/** Shared audit renderer: org tab (hide org column) and the global log. */
export function AuditTable({ rows, showOrg }: { rows: AuditRow[]; showOrg: boolean }) {
  if (rows.length === 0) {
    return <p className="px-5 py-6 text-sm text-neutral-400">No audit entries match.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-500">
          <tr>
            <th className="px-5 py-2 font-medium">When</th>
            {showOrg && <th className="px-3 py-2 font-medium">Org</th>}
            <th className="px-3 py-2 font-medium">Who</th>
            <th className="px-3 py-2 font-medium">What</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-5 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const founder = r.actorName.startsWith("founder:");
            return (
              <tr key={r.id} className={`border-t border-neutral-100 ${founder ? "bg-amber-50/40" : ""}`}>
                <td className="whitespace-nowrap px-5 py-2 text-xs text-neutral-500">
                  {r.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </td>
                {showOrg && (
                  <td className="px-3 py-2">
                    <Link href={`/admin/orgs/${r.orgId}`} className="font-medium hover:underline">
                      {r.org.name}
                    </Link>
                  </td>
                )}
                <td className="max-w-48 truncate px-3 py-2" title={r.actorName}>
                  {founder ? (
                    <span className="font-medium text-amber-800">{r.actorName.slice("founder:".length)}</span>
                  ) : (
                    r.actorName
                  )}
                </td>
                <td className="px-3 py-2">{AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action}</td>
                <td className="max-w-56 truncate px-3 py-2" title={r.target ?? ""}>
                  {r.target ?? "—"}
                </td>
                <td className="max-w-md truncate px-5 py-2 text-neutral-600" title={r.detail ?? ""}>
                  {r.detail ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
