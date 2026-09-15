import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Credit-pack top-ups (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 6). Same payment-integrity rules as the plan checkout: the pack is
 * derived from the paid ORDER (server-set notes + captured amount), never the
 * client. A top-up is a `purchase` grant expiring in 365 days, idempotent on
 * the gateway payment/session id, and it never touches Org.plan.
 */

const m = vi.hoisted(() => ({
  prisma: {
    org: { update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
    creditGrant: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  requireOrgContext: vi.fn(),
  createRazorpayOrder: vi.fn(),
  fetchRazorpayOrder: vi.fn(),
  verifyPaymentSignature: vi.fn(),
  createStripeCheckout: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma: m.prisma }));
vi.mock("@/modules/email", () => ({ appOrigin: () => "https://app.test" }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext: m.requireOrgContext,
  requireRole: (ctx: { role: string }, role: string) => {
    if (ctx.role !== "OWNER" && ctx.role !== role) throw new Error("You need the ADMIN role.");
  },
}));
vi.mock("@/modules/billing/razorpay", async (orig) => ({
  ...(await orig<typeof import("@/modules/billing/razorpay")>()),
  isRazorpayConfigured: () => true,
  razorpayKeyId: () => "rzp_test_key",
  createRazorpayOrder: m.createRazorpayOrder,
  fetchRazorpayOrder: m.fetchRazorpayOrder,
  verifyPaymentSignature: m.verifyPaymentSignature,
  verifyWebhookSignature: () => true,
}));
vi.mock("@/modules/billing/stripe", async (orig) => ({
  ...(await orig<typeof import("@/modules/billing/stripe")>()),
  isStripeConfigured: () => true,
  createStripeCheckout: m.createStripeCheckout,
  verifyStripeWebhook: () => true,
}));

import {
  confirmCreditCheckoutAction,
  startCreditCheckoutAction,
} from "@/app/(app)/settings/billing/actions";
import { POST as razorpayWebhook } from "@/app/api/webhooks/razorpay/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import {
  CREDIT_PACKS,
  PURCHASED_CREDIT_TTL_DAYS,
  creditPack,
  packPrice,
} from "@/modules/billing/credit-packs";
import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credit-rates";

const NOW = new Date("2026-09-16T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const ctxFor = (currency: string, role = "ADMIN") => ({
  role,
  org: { id: "org1", name: "Clinic", currency, plan: "starter" },
  userId: "u1",
  email: "e@x.com",
  membership: { displayName: "Dr. Rao" },
});
const form = (f: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  return fd;
};
const triple = {
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig",
};
const paidOrder = (over: Partial<{ amount: number; status: string; notes: Record<string, string> }> = {}) => ({
  id: "order_1",
  currency: "INR",
  amount: 999 * 100,
  status: "paid",
  notes: { orgId: "org1", kind: "credits", packId: "pack_1k" },
  ...over,
});
const duplicate = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(
    new Request("http://localhost/api/webhooks/x", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "x-razorpay-signature": "s", "stripe-signature": "t=1,v1=a" },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  m.requireOrgContext.mockResolvedValue(ctxFor("INR"));
  m.verifyPaymentSignature.mockReturnValue(true);
  m.prisma.creditGrant.create.mockResolvedValue({ id: "g1" });
  m.prisma.auditLog.create.mockResolvedValue({});
  m.prisma.org.findUnique.mockResolvedValue(null);
  m.createRazorpayOrder.mockResolvedValue({
    id: "order_1",
    amount: 999 * 100,
    currency: "INR",
    status: "created",
  });
  m.createStripeCheckout.mockResolvedValue({ id: "cs_1", url: "https://stripe.test/cs_1" });
});
afterEach(() => vi.useRealTimers());

describe("credit-packs (pure)", () => {
  it("lists the three packs and packPrice is null outside INR/SGD", () => {
    expect(CREDIT_PACKS.map((p) => [p.id, p.credits])).toEqual([
      ["pack_1k", 1_000],
      ["pack_5k", 5_000],
      ["pack_10k", 10_000],
    ]);
    const pack = creditPack("pack_5k")!;
    expect(packPrice(pack, "INR")).toBe(4_499);
    expect(packPrice(pack, "SGD")).toBe(89);
    expect(packPrice(pack, "USD")).toBeNull();
    expect(packPrice(pack, "MYR")).toBeNull();
    expect(creditPack("pack_999")).toBeNull();
    expect(PURCHASED_CREDIT_TTL_DAYS).toBe(365);
  });
});

describe("startCreditCheckoutAction", () => {
  it('creates a Razorpay order with kind:"credits" notes and the INR pack price', async () => {
    const r = await startCreditCheckoutAction("pack_1k");
    expect(r.ok).toBe(true);
    expect(m.createRazorpayOrder).toHaveBeenCalledWith(
      999 * 100,
      expect.stringContaining("credits_pack_1k"),
      { orgId: "org1", kind: "credits", packId: "pack_1k" }
    );
    expect(r.checkout).toMatchObject({
      keyId: "rzp_test_key",
      orderId: "order_1",
      amount: 999 * 100,
      currency: "INR",
    });
    expect(r.redirectUrl).toBeUndefined();
  });

  it("SGD org gets a Stripe redirect with credits metadata", async () => {
    m.requireOrgContext.mockResolvedValue(ctxFor("SGD"));
    const r = await startCreditCheckoutAction("pack_10k");
    expect(r.ok).toBe(true);
    expect(r.redirectUrl).toBe("https://stripe.test/cs_1");
    expect(m.createStripeCheckout).toHaveBeenCalledTimes(1);
    const input = m.createStripeCheckout.mock.calls[0][0];
    expect(input).toMatchObject({
      currency: "SGD",
      amountMinor: 169 * 100,
      orgId: "org1",
      metadata: { orgId: "org1", kind: "credits", packId: "pack_10k" },
    });
    expect(input.lineName).toContain("10,000");
    expect(input.planId).toBeUndefined();
    expect(m.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("USD org is refused (pack not sold)", async () => {
    m.requireOrgContext.mockResolvedValue(ctxFor("USD"));
    const r = await startCreditCheckoutAction("pack_1k");
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/contact us/i);
    expect(m.createStripeCheckout).not.toHaveBeenCalled();
    expect(m.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("unknown packId refused", async () => {
    const r = await startCreditCheckoutAction("pack_999");
    expect(r.ok).toBe(false);
    expect(m.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("non-admin refused", async () => {
    m.requireOrgContext.mockResolvedValue(ctxFor("INR", "MEMBER"));
    const r = await startCreditCheckoutAction("pack_1k");
    expect(r.ok).toBe(false);
    expect(m.createRazorpayOrder).not.toHaveBeenCalled();
  });
});

describe("confirmCreditCheckoutAction — payment integrity", () => {
  it("refuses when the paid order belongs to another org", async () => {
    m.fetchRazorpayOrder.mockResolvedValue(
      paidOrder({ notes: { orgId: "someone-else", kind: "credits", packId: "pack_1k" } })
    );
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(false);
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("refuses an order that is not a credits order (a plan order cannot be redeemed as credits)", async () => {
    m.fetchRazorpayOrder.mockResolvedValue(
      paidOrder({ amount: 4999 * 100, notes: { orgId: "org1", planId: "starter" } })
    );
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(false);
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
    expect(m.prisma.org.update).not.toHaveBeenCalled();
  });

  it("refuses when the captured amount doesn't match the pack price", async () => {
    m.fetchRazorpayOrder.mockResolvedValue(
      paidOrder({ amount: 999 * 100, notes: { orgId: "org1", kind: "credits", packId: "pack_10k" } })
    );
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(false);
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("refuses (and never fetches the order) on a bad signature", async () => {
    m.verifyPaymentSignature.mockReturnValue(false);
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(false);
    expect(m.fetchRazorpayOrder).not.toHaveBeenCalled();
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("refuses an order that is not paid yet", async () => {
    m.fetchRazorpayOrder.mockResolvedValue(paidOrder({ status: "attempted" }));
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(false);
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("grants 1,000 credits expiring +365d, idempotent on the paymentId, and never touches Org.plan", async () => {
    m.fetchRazorpayOrder.mockResolvedValue(paidOrder());
    const r = await confirmCreditCheckoutAction(form(triple));
    expect(r.ok).toBe(true);
    expect(r.message).toContain("1,000");
    expect(m.prisma.creditGrant.create).toHaveBeenCalledTimes(1);
    const data = m.prisma.creditGrant.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      orgId: "org1",
      kind: "purchase",
      sourceKey: "pay_1",
      amountMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      remainingMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
      note: "pack_1k",
    });
    expect(data.expiresAt.getTime()).toBe(NOW.getTime() + 365 * DAY);
    expect(m.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(m.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      orgId: "org1",
      actorUserId: "u1",
      action: "billing.credits_purchased",
    });
    expect(m.prisma.org.update).not.toHaveBeenCalled();
    expect(m.prisma.org.updateMany).not.toHaveBeenCalled();

    // The webhook already granted for this payment: the confirm is still ok, nothing doubled.
    m.prisma.creditGrant.create.mockRejectedValueOnce(duplicate());
    const again = await confirmCreditCheckoutAction(form(triple));
    expect(again.ok).toBe(true);
    expect(m.prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe("gateway webhooks — credits branch", () => {
  it("razorpay webhook grants once across two deliveries and never touches Org.plan", async () => {
    const event = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_wh_1",
            amount: 4499 * 100,
            notes: { orgId: "org1", kind: "credits", packId: "pack_5k" },
          },
        },
      },
    };
    expect((await post(razorpayWebhook, event)).status).toBe(200);
    m.prisma.creditGrant.create.mockRejectedValueOnce(duplicate());
    expect((await post(razorpayWebhook, event)).status).toBe(200);

    expect(m.prisma.creditGrant.create).toHaveBeenCalledTimes(2);
    for (const call of m.prisma.creditGrant.create.mock.calls) {
      expect(call[0].data).toMatchObject({
        orgId: "org1",
        kind: "purchase",
        sourceKey: "pay_wh_1",
        amountMicroUsd: 5_000 * MICRO_USD_PER_CREDIT,
      });
    }
    expect(m.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(m.prisma.org.updateMany).not.toHaveBeenCalled();
    expect(m.prisma.org.update).not.toHaveBeenCalled();
  });

  it("razorpay webhook still activates a plan when notes carry no kind", async () => {
    m.prisma.org.updateMany.mockResolvedValue({ count: 1 });
    const event = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_plan", notes: { orgId: "org1", planId: "starter" } } } },
    };
    expect((await post(razorpayWebhook, event)).status).toBe(200);
    expect(m.prisma.org.updateMany).toHaveBeenCalledTimes(1);
    expect(m.prisma.org.updateMany.mock.calls[0][0].data.plan).toBe("starter");
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });

  it("stripe webhook grants once and never changes Org.plan", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_1",
          payment_status: "paid",
          metadata: { orgId: "org1", kind: "credits", packId: "pack_1k" },
        },
      },
    };
    expect((await post(stripeWebhook, event)).status).toBe(200);
    m.prisma.creditGrant.create.mockRejectedValueOnce(duplicate());
    expect((await post(stripeWebhook, event)).status).toBe(200);

    expect(m.prisma.creditGrant.create).toHaveBeenCalledTimes(2);
    expect(m.prisma.creditGrant.create.mock.calls[0][0].data).toMatchObject({
      orgId: "org1",
      kind: "purchase",
      sourceKey: "cs_live_1",
      amountMicroUsd: 1_000 * MICRO_USD_PER_CREDIT,
    });
    expect(m.prisma.creditGrant.create.mock.calls[0][0].data.expiresAt.getTime()).toBe(
      NOW.getTime() + 365 * DAY
    );
    expect(m.prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(m.prisma.org.updateMany).not.toHaveBeenCalled();
  });

  it("stripe webhook ignores an unpaid credits session", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_unpaid",
          payment_status: "unpaid",
          metadata: { orgId: "org1", kind: "credits", packId: "pack_1k" },
        },
      },
    };
    expect((await post(stripeWebhook, event)).status).toBe(200);
    expect(m.prisma.creditGrant.create).not.toHaveBeenCalled();
  });
});
