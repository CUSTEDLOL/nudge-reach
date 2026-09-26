import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A workspace's own Razorpay account (2026-09-26). Customer money must land
 * with the business; before this, live links used Nudge's billing keys.
 */

vi.mock("server-only", () => ({}));
const { prisma } = vi.hoisted(() => ({
  prisma: {
    paymentConnection: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/crypto", () => ({
  encryptSecret: (v: string) => `enc(${v})`,
  decryptSecret: (v: string) => v.replace(/^enc\((.*)\)$/, "$1"),
}));

import {
  PaymentConnectionError,
  getPaymentCredentials,
  maskKeyId,
  savePaymentConnection,
} from "@/modules/payments/connection";

const ok = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
const rejected = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.paymentConnection.upsert.mockImplementation(async (args: { create: Record<string, unknown> }) => args.create);
});

describe("savePaymentConnection", () => {
  it("verifies the keys with Razorpay, then stores them encrypted with a fresh webhook", async () => {
    prisma.paymentConnection.findUnique.mockResolvedValue(null);
    await savePaymentConnection({ orgId: "o1", keyId: " rzp_live_Abcd1234Efgh ", keySecret: "s3cretS3cretS3cret" }, ok);
    const args = prisma.paymentConnection.upsert.mock.calls[0][0];
    expect(args.create.keyId).toBe("rzp_live_Abcd1234Efgh");
    expect(args.create.keySecretEncrypted).toBe("enc(s3cretS3cretS3cret)");
    expect(args.create.webhookSecretEncrypted).toMatch(/^enc\([0-9a-f]{48}\)$/);
    expect(args.create.webhookKey).toMatch(/^[0-9a-f]{48}$/);
  });

  it("keeps the webhook when an existing connection's keys are replaced", async () => {
    prisma.paymentConnection.findUnique.mockResolvedValue({ orgId: "o1" });
    await savePaymentConnection({ orgId: "o1", keyId: "rzp_live_Abcd1234Efgh", keySecret: "s3cretS3cretS3cret" }, ok);
    const update = prisma.paymentConnection.upsert.mock.calls[0][0].update;
    expect(update.webhookSecretEncrypted).toBeUndefined();
    expect(update.webhookKey).toBeUndefined();
  });

  it("saves nothing when Razorpay rejects the keys", async () => {
    await expect(
      savePaymentConnection({ orgId: "o1", keyId: "rzp_live_Abcd1234Efgh", keySecret: "s3cretS3cretS3cret" }, rejected)
    ).rejects.toThrow(/Razorpay rejected/);
    expect(prisma.paymentConnection.upsert).not.toHaveBeenCalled();
  });

  it("refuses malformed keys before calling Razorpay", async () => {
    const spy = vi.fn(ok);
    await expect(savePaymentConnection({ orgId: "o1", keyId: "pk_live_123", keySecret: "s3cretS3cretS3cret" }, spy as unknown as typeof fetch)).rejects.toBeInstanceOf(PaymentConnectionError);
    await expect(savePaymentConnection({ orgId: "o1", keyId: "rzp_live_Abcd1234Efgh", keySecret: "short" }, spy as unknown as typeof fetch)).rejects.toBeInstanceOf(PaymentConnectionError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("reads credentials back, and masks the key for display", async () => {
    prisma.paymentConnection.findUnique.mockResolvedValue({ keyId: "rzp_live_Abcd1234Efgh", keySecretEncrypted: "enc(s3cret)" });
    expect(await getPaymentCredentials("o1")).toEqual({ keyId: "rzp_live_Abcd1234Efgh", keySecret: "s3cret" });
    expect(maskKeyId("rzp_live_Abcd1234Efgh")).toBe("rzp_live_Abcd…Efgh");
  });
});
