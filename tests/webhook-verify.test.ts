import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { isStopMessage, verifyWebhookSignature } from "@/modules/whatsapp/webhook-verify";

const SECRET = "test-app-secret";

function sign(body: string): string {
  return (
    "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex")
  );
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ a: 1 });
    expect(verifyWebhookSignature('{"a":2}', sign(body), SECRET)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false);
    expect(verifyWebhookSignature("{}", "md5=abc", SECRET)).toBe(false);
    expect(verifyWebhookSignature("{}", "sha256=zzz", SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const body = "{}";
    expect(verifyWebhookSignature(body, sign(body), "other-secret")).toBe(
      false
    );
  });
});

describe("isStopMessage (opt-out detection)", () => {
  it("detects STOP in its common forms", () => {
    expect(isStopMessage("STOP")).toBe(true);
    expect(isStopMessage("stop")).toBe(true);
    expect(isStopMessage("  Stop please")).toBe(true);
    expect(isStopMessage("unsubscribe")).toBe(true);
    expect(isStopMessage("opt out")).toBe(true);
    expect(isStopMessage("opt-out")).toBe(true);
  });

  it("does not opt out normal replies", () => {
    expect(isStopMessage("Can you stop by my shop?")).toBe(false);
    expect(isStopMessage("What time do you open?")).toBe(false);
    expect(isStopMessage("nonstop")).toBe(false);
  });
});
