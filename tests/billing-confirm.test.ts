import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * HIGH regression (payment-integrity): confirmCheckoutAction must derive the
 * activated plan from the paid ORDER (server-set notes + captured amount), NOT
 * the client-supplied planId — otherwise a genuine ₹999 payment could be
 * redeemed for the ₹5,999 tier.
 */

const {
  requireOrgContext,
  verifyPaymentSignature,
  fetchRazorpayOrder,
  orgUpdate,
  recordAudit,
  revalidatePath,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  verifyPaymentSignature: vi.fn(),
  fetchRazorpayOrder: vi.fn(),
  orgUpdate: vi.fn().mockResolvedValue({}),
  recordAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma: { org: { update: orgUpdate } } }));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext,
  requireRole: () => {}, // ADMIN assumed here; the role gate is covered elsewhere
}));
vi.mock("@/modules/billing/razorpay", async (orig) => {
  const actual = await orig<typeof import("@/modules/billing/razorpay")>();
  return { ...actual, verifyPaymentSignature, fetchRazorpayOrder };
});

import { confirmCheckoutAction } from "@/app/(app)/settings/billing/actions";

const ctx = {
  role: "ADMIN",
  org: { id: "org1", name: "Shop", currency: "INR" },
  userId: "u1",
  email: "e@x.com",
  membership: {},
};
const form = (f: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  return fd;
};
const triple = {
  razorpay_order_id: "o1",
  razorpay_payment_id: "p1",
  razorpay_signature: "sig",
};

beforeEach(() => {
  orgUpdate.mockClear();
  fetchRazorpayOrder.mockReset();
  requireOrgContext.mockResolvedValue(ctx);
  verifyPaymentSignature.mockReturnValue(true);
});

describe("confirmCheckoutAction — payment integrity", () => {
  it("activates the plan from the ORDER notes, ignoring a spoofed client planId", async () => {
    // Paid ₹999 for starter; order notes say starter; client claims 'pro'.
    fetchRazorpayOrder.mockResolvedValue({
      id: "o1",
      status: "paid",
      amount: 999 * 100,
      currency: "INR",
      notes: { orgId: "org1", planId: "starter" },
    });
    const r = await confirmCheckoutAction(form({ ...triple, planId: "pro" }));
    expect(r.ok).toBe(true);
    expect(orgUpdate).toHaveBeenCalledTimes(1);
    expect(orgUpdate.mock.calls[0][0].data.plan).toBe("starter"); // NOT "pro"
  });

  it("refuses when the paid order belongs to another org", async () => {
    fetchRazorpayOrder.mockResolvedValue({
      id: "o1",
      status: "paid",
      amount: 999 * 100,
      currency: "INR",
      notes: { orgId: "someone-else", planId: "starter" },
    });
    const r = await confirmCheckoutAction(form({ ...triple, planId: "pro" }));
    expect(r.ok).toBe(false);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("refuses when the captured amount doesn't match the plan price", async () => {
    fetchRazorpayOrder.mockResolvedValue({
      id: "o1",
      status: "paid",
      amount: 1 * 100, // paid ₹1 but notes claim pro
      currency: "INR",
      notes: { orgId: "org1", planId: "pro" },
    });
    const r = await confirmCheckoutAction(form({ ...triple, planId: "pro" }));
    expect(r.ok).toBe(false);
    expect(orgUpdate).not.toHaveBeenCalled();
  });

  it("refuses (and never fetches the order) on a bad signature", async () => {
    verifyPaymentSignature.mockReturnValue(false);
    const r = await confirmCheckoutAction(form({ ...triple, planId: "starter" }));
    expect(r.ok).toBe(false);
    expect(fetchRazorpayOrder).not.toHaveBeenCalled();
    expect(orgUpdate).not.toHaveBeenCalled();
  });
});
