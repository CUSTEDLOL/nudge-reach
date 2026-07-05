import { prisma } from "@/lib/db";
import type { OrgContext } from "@/modules/orgs/auth";

/**
 * Append-only audit trail for sensitive actions (spec phase 4). Writes are
 * fire-and-forget: an audit failure must never fail the action it records.
 * Viewer: Settings → Audit log (admin+).
 */

export type AuditAction =
  | "member.role_changed"
  | "member.invited"
  | "member.invite_revoked"
  | "contact.opted_out"
  | "contact.deleted"
  | "campaign.sent"
  | "whatsapp.connected"
  | "api_key.created"
  | "api_key.revoked"
  | "webhook.created"
  | "webhook.deleted"
  | "billing.plan_changed"
  | "demo.reset";

/** Human labels for the viewer. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "member.role_changed": "Role changed",
  "member.invited": "Member invited",
  "member.invite_revoked": "Invite revoked",
  "contact.opted_out": "Contact opted out",
  "contact.deleted": "Contact deleted",
  "campaign.sent": "Campaign sent",
  "whatsapp.connected": "WhatsApp connection updated",
  "api_key.created": "API key created",
  "api_key.revoked": "API key revoked",
  "webhook.created": "Webhook added",
  "webhook.deleted": "Webhook removed",
  "billing.plan_changed": "Plan changed",
  "demo.reset": "Demo data reset",
};

export function recordAudit(
  ctx: Pick<OrgContext, "org" | "userId" | "email" | "membership">,
  action: AuditAction,
  target?: string,
  detail?: string
): void {
  void prisma.auditLog
    .create({
      data: {
        orgId: ctx.org.id,
        actorUserId: ctx.userId,
        actorName: ctx.membership.displayName || ctx.email || "Unknown",
        action,
        target: target?.slice(0, 200),
        detail: detail?.slice(0, 500),
      },
    })
    .catch((err) => console.error("[audit] write failed", err));
}
