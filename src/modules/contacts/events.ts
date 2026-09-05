import { prisma } from "@/lib/db";
import { syncContactEventToCrm } from "@/modules/crm/contact-events";

/**
 * Event types recorded so far (E0). The column is a plain string — later
 * workstreams add types without a migration; keep this union honest.
 */
export type ContactEventType =
  | "lead_stage_changed"
  | "opted_out"
  | "booking_status"
  | "payment_paid"
  | "widget_click";

/**
 * Append one row to the ContactEvent history (enterprise track E0).
 * Fire-and-forget, same pattern as recordAudit: scoring/analytics data must
 * never break the product flow that emits it.
 */
export function recordContactEvent(
  orgId: string,
  type: ContactEventType,
  opts: { contactId?: string | null; props?: Record<string, unknown> } = {}
): void {
  try {
    void prisma.contactEvent
      .create({
        data: {
          orgId,
          type,
          contactId: opts.contactId ?? null,
          props: (opts.props ?? {}) as object,
        },
      })
      .catch((err) => console.error("[contact-event] write failed", err));
    // Same history, second consumer: stage changes and opt-outs reach the
    // client's CRM from every site that emits them, not just the agent's.
    void syncContactEventToCrm(orgId, type, opts);
  } catch (err) {
    // Even a synchronous throw (e.g. a partially mocked client) must never
    // reach the product flow that emitted the event.
    console.error("[contact-event] write failed", err);
  }
}
