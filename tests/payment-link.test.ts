import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The collect-money path (flagship "real action"). Invariants under test:
 *  - amount bounds enforced (no ₹0 links, no absurd amounts)
 *  - flagship plan gate: free/self-serve orgs cannot mint links
 *  - simulation mode creates a recognizable fake link with zero keys
 *  - markPaymentPaid is idempotent (webhook retries can't double-note)
 *  - the agent tool returns the link as a plain instruction string
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

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "simulation" },
}));

import {
  createPaymentLink,
  markPaymentPaid,
  formatAmountMinor,
} from "@/modules/payments";
import { sendPaymentLinkTool } from "@/modules/agent/tools/send-payment-link";

const FLAGSHIP_ORG = { plan: "front_desk", currency: "INR" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue(FLAGSHIP_ORG);
  prisma.paymentRequest.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "pr_1",
      ...data,
    })
  );
  prisma.paymentRequest.update.mockResolvedValue({});
});

describe("createPaymentLink", () => {
  it("rejects amounts below ₹1 and above the cap", async () => {
    for (const amountMinor of [0, 50, -100, 51_00_000]) {
      const out = await createPaymentLink("org1", {
        contactId: "c1",
        amountMinor,
        purpose: "Deposit",
      });
      expect(out.status).toBe("invalid");
    }
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("blocks orgs without the AI Front Desk plan", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "free", currency: "INR" });
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      amountMinor: 50_000,
      purpose: "Deposit",
    });
    expect(out.status).toBe("not_allowed");
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });

  it("creates a simulation link with zero keys (invariant #4)", async () => {
    const out = await createPaymentLink("org1", {
      contactId: "c1",
      conversationId: "conv1",
      amountMinor: 50_000,
      purpose: "Booking deposit",
    });
    expect(out.status).toBe("created");
    if (out.status !== "created") return;
    expect(out.shortUrl).toContain("/pay/");
    expect(out.amountLabel).toBe("₹500");
    // Row recorded with the simulation provider, org-scoped.
    expect(prisma.paymentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org1", provider: "simulation" }),
      })
    );
  });
});

describe("markPaymentPaid", () => {
  it("flips created→paid once and notes it; retries are no-ops", async () => {
    prisma.paymentRequest.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.paymentRequest.findUnique.mockResolvedValue({
      id: "pr_1",
      orgId: "org1",
      contactId: "c1",
      conversationId: "conv1",
      amountMinor: 50_000,
      currency: "INR",
      purpose: "Deposit",
    });
    expect(await markPaymentPaid("pr_1")).toBe(true);
    expect(prisma.note.create).toHaveBeenCalledTimes(1);

    // Second delivery of the same webhook: status no longer "created".
    prisma.paymentRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await markPaymentPaid("pr_1")).toBe(false);
    expect(prisma.note.create).toHaveBeenCalledTimes(1);
  });
});

describe("send_payment_link tool", () => {
  const ctx = {
    orgId: "org1",
    contactId: "c1",
    conversationId: "conv1",
    contactName: "Priya",
    contactPhone: "+919999999999",
  };

  it("returns the link as an instruction and writes a note", async () => {
    const { result, isError } = await sendPaymentLinkTool.parseAndRun(ctx, {
      amount: 500,
      purpose: "Booking deposit — Saturday 7 PM",
    });
    expect(isError).toBeUndefined();
    expect(result).toContain("₹500");
    expect(result).toContain("/pay/");
    expect(prisma.note.create).toHaveBeenCalled();
  });

  it("rejects invalid model input via the schema (recoverable)", async () => {
    const { isError } = await sendPaymentLinkTool.parseAndRun(ctx, {
      amount: -5,
      purpose: "x",
    });
    expect(isError).toBe(true);
    expect(prisma.paymentRequest.create).not.toHaveBeenCalled();
  });
});

describe("formatAmountMinor", () => {
  it("formats INR and USD", () => {
    expect(formatAmountMinor(50_000, "INR")).toBe("₹500");
    expect(formatAmountMinor(123_450, "USD")).toBe("USD 1,234.5");
  });
});
