import type { Metadata } from "next";
import { ScrollText, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOrgContext, hasRole } from "@/modules/orgs/auth";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/modules/orgs/audit";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionHeader } from "../section-header";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function AuditLogPage() {
  const ctx = await requireOrgContext();

  if (!hasRole(ctx.role, "ADMIN")) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="The audit log is for admins"
        description="Ask a workspace admin or the owner if you need something checked."
      />
    );
  }

  const entries = await prisma.auditLog.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <section>
      <SectionHeader
        title="Audit log"
        description={`Who did what, when — the last ${PAGE_SIZE} sensitive actions in this workspace.`}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" aria-hidden />}
          title="Nothing recorded yet"
          description="Role changes, opt-outs, campaign sends, connection and key changes will appear here."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-neutral-500">
                    {formatWhen(e.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium text-neutral-900">
                    {e.actorName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {AUDIT_ACTION_LABELS[e.action as AuditAction] ?? e.action}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={e.target ?? ""}>
                    {e.target ?? "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate text-neutral-500"
                    title={e.detail ?? ""}
                  >
                    {e.detail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  );
}
