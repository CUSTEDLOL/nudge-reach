import { prisma } from "@/lib/db";
import type { AuditAction } from "@/modules/orgs/audit";

/**
 * Every founder mutation leaves a row in the ORG's own audit log, attributed
 * to `founder:<email>` so the client sees exactly what Nudge support did in
 * their workspace (Settings → Audit log renders the admin.* labels). Founders
 * are not org members, so this writes directly rather than via recordAudit.
 * Awaited, not fire-and-forget: an unaudited founder change must not happen.
 */
export type FounderAuditAction = Extract<AuditAction, `admin.${string}`>;

export async function founderAudit(
  orgId: string,
  founderEmail: string,
  action: FounderAuditAction,
  target?: string | null,
  detail?: string | null
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: "founder",
      actorName: `founder:${founderEmail}`,
      action,
      target: target?.slice(0, 200) ?? null,
      detail: detail?.slice(0, 500) ?? null,
    },
  });
}

/** Shared result shape for every founder mutation. */
export type FounderResult = { ok: true; message: string } | { ok: false; error: string };

/** A short "why" the founder types before a sensitive change; kept in `detail`. */
export function withReason(detail: string, reason: string | null | undefined): string {
  const r = reason?.trim();
  return r ? `${detail} — reason: ${r}` : detail;
}
