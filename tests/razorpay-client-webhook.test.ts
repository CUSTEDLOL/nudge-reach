import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A workspace's own Razorpay webhook. The opaque key picks the workspace, its
 * own secret proves the sender, and a paid link can only settle that same
 * workspace's payment request: a merchant controls their account's link notes,
 * so one tenant must not be able to mark another's deposit paid.
 */

const { prisma, markPaymentPaid } = vi.hoisted(() => ({
  prisma: { paymentConnection: { findUnique: vi.fn(), update: vi.fn(async () => ({})) } },
  markPaymentPaid: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/crypto", () => ({ decryptSecret: (v: string) => v }));
vi.mock("@/modules/payments", () => ({ markPaymentPaid }));
vi.mock("@/lib/env", () => ({ env: {} }));

import { POST } from "@/app/api/webhooks/razorpay/[connectionKey]/route";

const SECRET = "client-webhook-secret";
const paid = JSON.stringify({
  event: "payment_link.paid",
  payload: { payment_link: { entity: { notes: { kind: "customer_payment", paymentRequestId: "pr_1" } } } },
});
const sign = (body: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(body).digest("hex");
const post = (body: string, signature: string, key = "k1") =>
  POST(new Request("https://nudgeagent.app/api/webhooks/razorpay/" + key, { method: "POST", body, headers: { "x-razorpay-signature": signature } }), {
    params: Promise.resolve({ connectionKey: key }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  prisma.paymentConnection.findUnique.mockResolvedValue({ id: "pc1", orgId: "org-A", webhookSecretEncrypted: SECRET });
});

describe("POST /api/webhooks/razorpay/[connectionKey]", () => {
  it("settles the payment, scoped to the connection's own workspace", async () => {
    const res = await post(paid, sign(paid));
    expect(res.status).toBe(200);
    expect(markPaymentPaid).toHaveBeenCalledWith("pr_1", "org-A");
    expect(prisma.paymentConnection.update).toHaveBeenCalledWith({ where: { id: "pc1" }, data: { lastEventAt: expect.any(Date) } });
  });

  it("rejects a body signed with anyone else's secret", async () => {
    const res = await post(paid, sign(paid, "another-workspace-secret"));
    expect(res.status).toBe(401);
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });

  it("404s an unknown webhook key", async () => {
    prisma.paymentConnection.findUnique.mockResolvedValue(null);
    expect((await post(paid, sign(paid), "nope")).status).toBe(404);
  });

  it("counts any signed event as proof the webhook is wired, without settling anything", async () => {
    const ping = JSON.stringify({ event: "payment.authorized", payload: {} });
    expect((await post(ping, sign(ping))).status).toBe(200);
    expect(prisma.paymentConnection.update).toHaveBeenCalled();
    expect(markPaymentPaid).not.toHaveBeenCalled();
  });
});
