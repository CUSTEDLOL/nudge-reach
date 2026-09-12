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
  | "calendar.connected"
  | "calendar.disconnected"
  | "followup.enabled"
  | "followup.disabled"
  | "concierge.client_setup"
  | "demo.reset"
  | "knowledge.answered"
  | "knowledge.dismissed"
  | "knowledge.entry_archived"
  | "knowledge.website_imported"
  | "knowledge.file_imported"
  | "knowledge.gbp_imported"
  | "knowledge.drafts_approved"
  | "knowledge.drafts_discarded"
  | "voice.number_saved"
  | "custom_action.created"
  | "custom_action.updated"
  | "custom_action.deleted"
  | "llm.connected"
  | "llm.disconnected"
  // Founder panel (src/modules/admin) — actor is "founder:<email>".
  | "admin.workspace_created"
  | "admin.plan_changed"
  | "admin.trial_changed"
  | "admin.subscription_changed"
  | "admin.mode_changed"
  | "admin.voice_minutes_changed"
  | "admin.suspended"
  | "admin.unsuspended"
  | "admin.overrides_changed"
  | "admin.member_role_changed"
  | "admin.member_removed"
  | "admin.ownership_transferred"
  | "admin.invite_created"
  | "admin.invite_delivery"
  | "admin.invite_revoked"
  | "admin.integration_disconnected"
  | "admin.integration_changed"
  | "admin.agent_toggled"
  | "admin.followups_toggled"
  | "admin.client_setup"
  | "admin.operation_requested"
  | "admin.operation_completed"
  | "admin.operation_failed";

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
  "calendar.connected": "Calendar connected",
  "calendar.disconnected": "Calendar disconnected",
  "followup.enabled": "Revenue Recovery enabled",
  "followup.disabled": "Revenue Recovery paused",
  "concierge.client_setup": "Concierge client setup",
  "demo.reset": "Demo data reset",
  "knowledge.answered": "Owner answered agent question",
  "knowledge.dismissed": "Agent question dismissed",
  "knowledge.entry_archived": "Knowledge fact archived",
  "knowledge.website_imported": "Website imported into knowledge drafts",
  "knowledge.file_imported": "File imported into knowledge drafts",
  "knowledge.gbp_imported": "Google Business Profile imported into knowledge drafts",
  "knowledge.drafts_approved": "Imported knowledge drafts approved",
  "knowledge.drafts_discarded": "Imported knowledge drafts discarded",
  "voice.number_saved": "Voice number saved",
  "custom_action.created": "Custom agent action created",
  "custom_action.updated": "Custom agent action updated",
  "custom_action.deleted": "Custom agent action deleted",
  "llm.connected": "Own AI model connected",
  "llm.disconnected": "Own AI model disconnected",
  "admin.workspace_created": "Nudge support created this workspace",
  "admin.plan_changed": "Nudge support changed the plan",
  "admin.trial_changed": "Nudge support changed the trial",
  "admin.subscription_changed": "Nudge support changed the subscription status",
  "admin.mode_changed": "Nudge support switched live/test mode",
  "admin.voice_minutes_changed": "Nudge support changed the call-minute allowance",
  "admin.suspended": "Nudge support suspended the workspace",
  "admin.unsuspended": "Nudge support lifted the suspension",
  "admin.overrides_changed": "Nudge support changed feature overrides",
  "admin.member_role_changed": "Nudge support changed a member's role",
  "admin.member_removed": "Nudge support removed a member",
  "admin.ownership_transferred": "Nudge support transferred ownership",
  "admin.invite_created": "Nudge support created an invite",
  "admin.invite_delivery": "Nudge support sent an invite email",
  "admin.invite_revoked": "Nudge support revoked an invite",
  "admin.integration_disconnected": "Nudge support disconnected an integration",
  "admin.integration_changed": "Nudge support changed an integration",
  "admin.agent_toggled": "Nudge support switched the AI Front Desk on/off",
  "admin.followups_toggled": "Nudge support switched follow-ups on/off",
  "admin.client_setup": "Nudge support ran concierge setup",
  "admin.operation_requested": "Nudge support requested an operational recovery",
  "admin.operation_completed": "Nudge support completed an operational recovery",
  "admin.operation_failed": "Nudge support recovery failed",
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
