import { describe, expect, it, vi } from "vitest";
const enqueueCrmEvent = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/modules/crm/sync", () => ({ enqueueCrmEvent }));
import { crmBookingCreated, crmContactCreated, crmHandoffRequested, crmLeadQualified, crmPaymentPaid } from "@/modules/crm/events";

describe("crm events", () => {
  it("maps product events to queue payloads", async () => {
    await crmContactCreated("o", { id: "c1", phoneE164: "+91", name: "+91" }, "WhatsApp (Nudge)", "Ad: PRP");
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "contact.created", "c1", {
      kind: "lead", lead: { phoneE164: "+91", name: "+91", source: "WhatsApp (Nudge)", description: "Ad: PRP" },
    });
    await crmLeadQualified("o", { id: "c1", phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "lead.qualified", "c1", { kind: "stage", phoneE164: "+91", stage: "qualified" });
    await crmBookingCreated("o", { id: "b1", name: "Priya", requestedFor: "tomorrow 5pm", scheduledFor: new Date("2026-09-02T11:30:00Z") }, { phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "booking.created", "b1", {
      kind: "activity", phoneE164: "+91",
      activity: { kind: "task", title: "Appointment: Priya — tomorrow 5pm", body: "Booked via Nudge.", dueAt: new Date("2026-09-02T11:30:00Z"), priority: "normal" },
    });
    await crmPaymentPaid("o", { id: "p1", amountMinorUnits: 50000, currency: "INR", purpose: "deposit" }, { phoneE164: "+91" });
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "payment.paid", "p1", {
      kind: "activity", phoneE164: "+91", activity: { kind: "note", title: "Payment received", body: "INR 500.00 — deposit (via Nudge)" },
    });
    await crmHandoffRequested("o", "cv1", { phoneE164: "+91" }, "wants a human");
    expect(enqueueCrmEvent).toHaveBeenLastCalledWith("o", "handoff.requested", "cv1", {
      kind: "activity", phoneE164: "+91", activity: { kind: "task", title: "Customer asked for a person", body: "wants a human", priority: "high" },
    });
  });
  it("never throws when the queue fails", async () => {
    enqueueCrmEvent.mockRejectedValueOnce(new Error("db down"));
    await expect(crmLeadQualified("o", { id: "c", phoneE164: "+91" })).resolves.toBeUndefined();
  });
});
