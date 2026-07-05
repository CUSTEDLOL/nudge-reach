import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  signWebhook,
  generateWebhookSecret,
  isWebhookEvent,
  WEBHOOK_EVENTS,
} from "@/modules/integrations/outbound-webhooks";

describe("signWebhook", () => {
  it("produces a sha256= HMAC that a receiver can verify", () => {
    const body = JSON.stringify({ event: "message.received", data: { x: 1 } });
    const secret = "whsec_test";
    const sig = signWebhook(body, secret);
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(sig).toBe(expected);
    expect(sig.startsWith("sha256=")).toBe(true);
  });

  it("changes when the body changes (tamper-evident)", () => {
    const secret = "whsec_test";
    expect(signWebhook("a", secret)).not.toBe(signWebhook("b", secret));
  });

  it("changes when the secret changes", () => {
    expect(signWebhook("a", "s1")).not.toBe(signWebhook("a", "s2"));
  });
});

describe("generateWebhookSecret", () => {
  it("is prefixed and unguessable-length", () => {
    const s = generateWebhookSecret();
    expect(s.startsWith("whsec_")).toBe(true);
    expect(s.length).toBeGreaterThan(40);
  });

  it("is unique per call", () => {
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

describe("isWebhookEvent", () => {
  it("accepts known events and rejects unknown", () => {
    expect(isWebhookEvent("message.received")).toBe(true);
    expect(isWebhookEvent("campaign.completed")).toBe(true);
    expect(isWebhookEvent("nonsense.event")).toBe(false);
    expect(isWebhookEvent("")).toBe(false);
  });

  it("every catalog event round-trips through the guard", () => {
    for (const e of WEBHOOK_EVENTS) {
      expect(isWebhookEvent(e.value)).toBe(true);
    }
  });
});
