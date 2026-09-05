import { enqueueCrmEvent, type CrmPayload } from "@/modules/crm/sync";
import type { CrmEvent } from "@/modules/crm/types";

/**
 * Thin hooks product code calls (void, never throw, never block the caller).
 * Each turns a Nudge event into a queued CRM write.
 */

async function safe(orgId: string, event: CrmEvent, entityId: string, payload: CrmPayload): Promise<void> {
  try {
    await enqueueCrmEvent(orgId, event, entityId, payload);
  } catch (e) {
    console.warn(`[crm] enqueue ${event} failed: ${(e as Error).message}`);
  }
}

export function crmContactCreated(
  orgId: string,
  contact: { id: string; phoneE164: string; name: string },
  source: "WhatsApp (Nudge)" | "Phone (Nudge)",
  description?: string
) {
  return safe(orgId, "contact.created", contact.id, {
    kind: "lead",
    lead: { phoneE164: contact.phoneE164, name: contact.name, source, ...(description ? { description } : {}) },
  });
}

export function crmBookingCreated(
  orgId: string,
  booking: { id: string; name: string; requestedFor: string; scheduledFor: Date | null },
  contact: { phoneE164: string }
) {
  return safe(orgId, "booking.created", booking.id, {
    kind: "activity",
    phoneE164: contact.phoneE164,
    activity: {
      kind: "task",
      title: `Appointment: ${booking.name} — ${booking.requestedFor}`,
      body: "Booked via Nudge.",
      ...(booking.scheduledFor ? { dueAt: booking.scheduledFor } : {}),
      priority: "normal",
    },
  });
}

export function crmPaymentPaid(
  orgId: string,
  payment: { id: string; amountMinorUnits: number; currency: string; purpose: string },
  contact: { phoneE164: string }
) {
  const amount = (payment.amountMinorUnits / 100).toFixed(2);
  return safe(orgId, "payment.paid", payment.id, {
    kind: "activity",
    phoneE164: contact.phoneE164,
    activity: { kind: "note", title: "Payment received", body: `${payment.currency} ${amount} — ${payment.purpose} (via Nudge)` },
  });
}

export function crmHandoffRequested(
  orgId: string,
  conversationId: string,
  contact: { phoneE164: string },
  reason: string
) {
  return safe(orgId, "handoff.requested", conversationId, {
    kind: "activity",
    phoneE164: contact.phoneE164,
    activity: { kind: "task", title: "Customer asked for a person", body: reason, priority: "high" },
  });
}

export function crmConversationSummary(
  orgId: string,
  conversationId: string,
  contact: { phoneE164: string },
  summary: string
) {
  return safe(orgId, "conversation.summary", `${conversationId}:${new Date().toISOString().slice(0, 10)}`, {
    kind: "activity",
    phoneE164: contact.phoneE164,
    activity: { kind: "note", title: "Conversation summary", body: summary },
  });
}
