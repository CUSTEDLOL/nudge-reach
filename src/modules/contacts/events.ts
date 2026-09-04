import { prisma } from "@/lib/db";

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
}
