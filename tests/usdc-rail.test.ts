import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The on-chain deposit rail (hackathon: AIsa/x402 USDC). Invariants under test:
 *  - rail defaults to fiat: existing callers see zero behavior change
 *  - usdc rail mints a USDC-denominated row served by the hosted /pay page
 *  - flagship plan gate applies to the usdc rail exactly like fiat
 *  - usdc rail never touches Razorpay, even when live keys exist
 *  - the agent tool maps method "usdc" onto the rail
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
import { sendPaymentLinkTool } from "@/modules/agent/tools/send-payment-link";

const FLAGSHIP_ORG = { plan: "front_desk", currency: "INR" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue(FLAGSHIP_ORG);
  prisma.paymentRequest.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "pr_usdc_1",
      ...data,
    })
  );
  prisma.paymentRequest.update.mockResolvedValue({});
  createRazorpayPaymentLink.mockResolvedValue({
    id: "plink_1",
    short_url: "https://rzp.io/l/x",
  });
});

describe("createPaymentLink usdc rail", () => {
  it("mints a USDC row served by /pay, bypassing Razorpay even in live mode", async () => {
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      conversationId: "conv1",
      amountMinor: 50_000, // USDC 500.00
      purpose: "Consultation deposit",
      rail: "usdc",
    });

    expect(out.status).toBe("created");
    if (out.status !== "created") return;
    expect(out.shortUrl).toMatch(/\/pay\/pr_usdc_1$/);
    expect(out.amountLabel).toBe("USDC 500");
    expect(createRazorpayPaymentLink).not.toHaveBeenCalled();

    const created = prisma.paymentRequest.create.mock.calls[0][0].data;
    expect(created.currency).toBe("USDC");
    expect(created.provider).toBe("simulation");
  });

  it("defaults to the fiat rail when rail is omitted (live → Razorpay)", async () => {
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

  it("keeps the flagship plan gate on the usdc rail", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "free", currency: "INR" });
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      amountMinor: 50_000,
      purpose: "Deposit",
      rail: "usdc",
    });
    expect(out.status).toBe("not_allowed");
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("keeps amount bounds on the usdc rail", async () => {
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      amountMinor: 0,
      purpose: "Deposit",
      rail: "usdc",
    });
    expect(out.status).toBe("invalid");
  });
});

describe("send_payment_link tool with method usdc", () => {
  const ctx = { orgId: "org1", contactId: "c1", conversationId: "conv1" };

  it("maps method 'usdc' to the usdc rail and returns the on-chain link", async () => {
    const { result: reply } = await sendPaymentLinkTool.parseAndRun(ctx as never, {
      amount: 500,
      purpose: "Consultation deposit",
      method: "usdc",
    });
    expect(reply).toContain("/pay/pr_usdc_1");
    expect(reply).toContain("USDC 500");
    const created = prisma.paymentRequest.create.mock.calls[0][0].data;
    expect(created.currency).toBe("USDC");
  });

  it("stays on the fiat rail when method is omitted", async () => {
    await sendPaymentLinkTool.parseAndRun(ctx as never, {
      amount: 500,
      purpose: "Deposit",
    });
    const created = prisma.paymentRequest.create.mock.calls[0][0].data;
    expect(created.currency).toBe("INR");
  });
});
