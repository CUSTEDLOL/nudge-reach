import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Live-mode provider selection for customer payment links: a live org with
 * Razorpay keys gets a real Razorpay link (simulation orgs are covered in
 * payment-link.test.ts).
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    paymentRequest: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    note: { create: vi.fn().mockResolvedValue({}) },
  },
}));

const { createRazorpayPaymentLink } = vi.hoisted(() => ({
  createRazorpayPaymentLink: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", RAZORPAY_KEY_ID: "rzp_x", RAZORPAY_KEY_SECRET: "s" },
}));
vi.mock("@/modules/billing/razorpay", () => ({
  createRazorpayPaymentLink,
  isRazorpayConfigured: () => true,
}));

import { createPaymentLink } from "@/modules/payments";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ plan: "front_desk", currency: "INR" });
  prisma.paymentRequest.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "pr_1", ...data })
  );
  prisma.paymentRequest.update.mockResolvedValue({});
  createRazorpayPaymentLink.mockResolvedValue({
    id: "plink_1",
    short_url: "https://rzp.io/l/x",
  });
});

describe("createPaymentLink in live mode", () => {
  it("routes through Razorpay with the org currency", async () => {
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      amountMinor: 50_000,
      purpose: "Deposit",
    });
    expect(out.status).toBe("created");
    expect(createRazorpayPaymentLink).toHaveBeenCalledOnce();
    const created = prisma.paymentRequest.create.mock.calls[0][0].data;
    expect(created.currency).toBe("INR");
  });
});
