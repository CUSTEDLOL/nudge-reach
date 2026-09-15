import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "@/modules/orgs/audit";
import type { OwnerSetupLink } from "@/modules/orgs/owner-setup";

/**
 * Every founder mutation leaves a row in the ORG's own audit log, attributed
 * to `founder:<email>` so the client sees exactly what Nudge support did in
 * their workspace (Settings → Audit log renders the admin.* labels). Founders
 * are not org members, so this writes directly rather than via recordAudit.
 * Awaited, not fire-and-forget: an unaudited founder change must not happen.
 * Returns the row id so a change can be keyed on its own audit entry (a
 * founder credit grant uses it as the grant's idempotency key).
 */
export type FounderAuditAction = Extract<AuditAction, `admin.${string}`>;
type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function founderAudit(
  orgId: string,
  founderEmail: string,
  action: FounderAuditAction,
  target?: string | null,
  detail?: string | null,
  db: AuditClient = prisma
): Promise<string> {
  const row = await db.auditLog.create({
    data: {
      orgId,
      actorUserId: "founder",
      actorName: `founder:${founderEmail}`,
      action,
      target: target?.slice(0, 200) ?? null,
      detail: detail?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });
  return row.id;
}

/** Shared result shape for every founder mutation. */
export type FounderResult =
  | { ok: true; message: string; setupLink?: OwnerSetupLink }
  | { ok: false; error: string };

/** A short "why" the founder types before a sensitive change; kept in `detail`. */
export function withReason(detail: string, reason: string | null | undefined): string {
  const r = reason?.trim();
  return r ? `${detail} — reason: ${r}` : detail;
}
