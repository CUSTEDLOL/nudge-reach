import Link from "next/link";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/modules/orgs/audit";
import { auditResult, type AuditRow } from "@/modules/admin/audit-log";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const resultTone: Record<ReturnType<typeof auditResult>, BadgeTone> = {
  requested: "info",
  failed: "danger",
  completed: "success",
};

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
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="px-3 py-2 font-medium">What</th>
            <th className="px-3 py-2 font-medium">Target</th>
            <th className="px-5 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const founder = r.actorName.startsWith("founder:");
            const result = auditResult(r.action);
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
                <td className="max-w-48 break-words px-3 py-2">
                  {founder ? (
                    <span className="font-medium text-amber-800">{r.actorName.slice("founder:".length)}</span>
                  ) : (
                    r.actorName
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={resultTone[result]}>{result}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div>{AUDIT_ACTION_LABELS[r.action as AuditAction] ?? r.action}</div>
                  <div className="mt-0.5 whitespace-nowrap text-xs text-neutral-400">{r.action}</div>
                </td>
                <td className="max-w-56 break-words px-3 py-2">
                  {r.target ?? "—"}
                </td>
                <td className="max-w-md px-5 py-2 text-neutral-600">
                  {r.detail ? (
                    <details className="group">
                      <summary className="max-w-72 cursor-pointer truncate rounded-sm outline-none marker:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
                        {r.detail}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-700">
                        {r.detail}
                      </p>
                    </details>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
