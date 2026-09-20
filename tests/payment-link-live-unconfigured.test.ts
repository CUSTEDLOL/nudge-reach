import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A LIVE workspace on a platform with no payment provider (production on
 * 2026-09-19) must get NO link. The fallback is the hosted practice page that
 * "settles" on click and is marked paid by the cron: to a real customer that
 * is a fake checkout, and the owner would see a deposit that never arrived.
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    paymentRequest: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    note: { create: vi.fn().mockResolvedValue({}) },
  },
}));
const { createRazorpayPaymentLink } = vi.hoisted(() => ({ createRazorpayPaymentLink: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "live" } }));
vi.mock("@/modules/billing/razorpay", () => ({
  createRazorpayPaymentLink,
  isRazorpayConfigured: () => false,
}));

import { createPaymentLink } from "@/modules/payments";

beforeEach(() => vi.clearAllMocks());

describe("createPaymentLink — live workspace, no provider configured", () => {
  it("refuses instead of sending a real customer a practice payment page", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "pro", currency: "INR", simulated: false });
    const out = await createPaymentLink("org1", { contactId: "c1", amountMinor: 50_000, purpose: "Deposit" });
    expect(out.status).toBe("not_allowed");
    expect(out.status === "not_allowed" && out.reason).toMatch(/aren't switched on/);
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("still gives a TEST workspace its practice link", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "pro", currency: "INR", simulated: true });
    prisma.paymentRequest.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "pr_1", ...data }));
    prisma.paymentRequest.update.mockResolvedValue({});
    const out = await createPaymentLink("org1", { contactId: "c1", amountMinor: 50_000, purpose: "Deposit" });
    expect(out.status).toBe("created");
    expect(prisma.paymentRequest.create.mock.calls[0][0].data.provider).toBe("simulation");
  });
});
