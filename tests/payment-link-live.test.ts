import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Live-mode provider selection for customer payment links: a live org with
 * its OWN connected Razorpay account gets a real link, made with that
 * account's keys (simulation orgs are covered in payment-link.test.ts).
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
vi.mock("@/modules/billing/razorpay", () => ({ createRazorpayPaymentLink }));
const { getPaymentCredentials } = vi.hoisted(() => ({ getPaymentCredentials: vi.fn() }));
vi.mock("@/modules/payments/connection", () => ({ getPaymentCredentials }));

import { createPaymentLink } from "@/modules/payments";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ plan: "front_desk", currency: "INR", simulated: false });
  getPaymentCredentials.mockResolvedValue({ keyId: "rzp_live_clientkey1", keySecret: "client-secret" });
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
    // The workspace's own account, never Nudge's billing keys.
    expect(createRazorpayPaymentLink.mock.calls[0][0].credentials).toEqual({ keyId: "rzp_live_clientkey1", keySecret: "client-secret" });
    expect(getPaymentCredentials).toHaveBeenCalledWith("org1");
  });

  it("refuses when the workspace has not connected its own Razorpay", async () => {
    getPaymentCredentials.mockResolvedValue(null);
    const out = await createPaymentLink("org1", { contactId: "c1", amountMinor: 50_000, purpose: "Deposit" });
    expect(out.status).toBe("not_allowed");
    expect(out.status === "not_allowed" && out.reason).toMatch(/no Razorpay account connected/);
    expect(createRazorpayPaymentLink).not.toHaveBeenCalled();
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("refuses a workspace that does not bill in INR", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "front_desk", currency: "SGD", simulated: false });
    const out = await createPaymentLink("org1", { contactId: "c1", amountMinor: 50_000, purpose: "Deposit" });
    expect(out.status).toBe("not_allowed");
    expect(out.status === "not_allowed" && out.reason).toMatch(/INR only/);
    expect(getPaymentCredentials).not.toHaveBeenCalled();
  });
});
