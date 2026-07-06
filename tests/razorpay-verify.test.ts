import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "@/modules/billing/razorpay";

const SECRET = "test_secret_key";

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

describe("verifyPaymentSignature (checkout callback)", () => {
  const input = { orderId: "order_123", paymentId: "pay_456" };
  const good = sign(`${input.orderId}|${input.paymentId}`);

  it("accepts the correct signature", () => {
    expect(
      verifyPaymentSignature({ ...input, signature: good }, SECRET)
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const bad = good.replace(/^./, good[0] === "a" ? "b" : "a");
    expect(verifyPaymentSignature({ ...input, signature: bad }, SECRET)).toBe(
      false
    );
  });

  it("rejects a signature for different ids", () => {
    const other = sign("order_999|pay_456");
    expect(
      verifyPaymentSignature({ ...input, signature: other }, SECRET)
    ).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(
      verifyPaymentSignature({ ...input, signature: good }, undefined)
    ).toBe(false);
  });

  it("rejects empty/malformed signatures without throwing", () => {
    expect(verifyPaymentSignature({ ...input, signature: "" }, SECRET)).toBe(
      false
    );
    expect(
      verifyPaymentSignature({ ...input, signature: "not-hex!!" }, SECRET)
    ).toBe(false);
  });
});

describe("verifyWebhookSignature (server-to-server)", () => {
  const body = JSON.stringify({ event: "payment.captured" });

  it("accepts the correct signature", () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a signature over a different body", () => {
    expect(verifyWebhookSignature(body, sign(body + "x"), SECRET)).toBe(false);
  });

  it("rejects missing signature or secret", () => {
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), undefined)).toBe(false);
  });
});
