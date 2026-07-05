import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { normalizePhoneE164 } from "@/lib/phone";
import { verifyStripeWebhook } from "@/modules/billing/stripe";
import {
  CURRENCIES,
  CURRENCY_INFO,
  formatMoney,
  formatPlanPrice,
  isCurrency,
  orgCurrency,
  presetForDialCode,
} from "@/modules/billing/money";
import { PLANS, planPrice } from "@/modules/billing/plans";

describe("normalizePhoneE164 — country-aware (global outreach)", () => {
  it("keeps the original Indian defaults intact", () => {
    expect(normalizePhoneE164("9876543210")).toBe("+919876543210");
    expect(normalizePhoneE164("09876543210")).toBe("+919876543210");
    expect(normalizePhoneE164("919876543210")).toBe("+919876543210");
  });

  it("prefixes bare local numbers with the org dial code", () => {
    expect(normalizePhoneE164("501234567", "+971")).toBe("+971501234567");
    expect(normalizePhoneE164("0501234567", "+971")).toBe("+971501234567");
    expect(normalizePhoneE164("11987654321", "+55")).toBe("+5511987654321");
  });

  it("respects full international form regardless of org country", () => {
    expect(normalizePhoneE164("+919876543210", "+971")).toBe("+919876543210");
    expect(normalizePhoneE164("00971501234567", "+91")).toBe("+971501234567");
  });

  it("handles cc-typed-without-plus for the org's own country", () => {
    expect(normalizePhoneE164("971501234567", "+971")).toBe("+971501234567");
  });

  it("rejects garbage", () => {
    expect(normalizePhoneE164("hello", "+971")).toBeNull();
    expect(normalizePhoneE164("12", "+91")).toBeNull();
    expect(normalizePhoneE164("", "+1")).toBeNull();
  });
});

describe("money", () => {
  it("formats minor units per currency", () => {
    expect(formatMoney(12345, "USD")).toBe("$123.45");
    expect(formatMoney(99, "INR")).toBe("₹0.99");
  });

  it("formats plan prices with locale grouping", () => {
    expect(formatPlanPrice(2499, "INR")).toBe("₹2,499");
    expect(formatPlanPrice(69, "USD")).toBe("$69");
  });

  it("orgCurrency falls back to INR for unknown values", () => {
    expect(orgCurrency({ currency: "USD" })).toBe("USD");
    expect(orgCurrency({ currency: "EUR" })).toBe("INR");
    expect(isCurrency("USD")).toBe(true);
    expect(isCurrency("BTC")).toBe(false);
  });

  it("every plan has a sensible USD price ladder", () => {
    const usd = PLANS.map((p) => planPrice(p, "USD"));
    expect(usd).toEqual([0, 29, 69, 159]);
    for (let i = 1; i < usd.length; i++) expect(usd[i]).toBeGreaterThan(usd[i - 1]);
  });

  it("every currency carries a positive default message rate + gateway", () => {
    for (const c of CURRENCIES) {
      expect(CURRENCY_INFO[c].defaultMessageRateMinor).toBeGreaterThan(0);
      expect(["razorpay", "stripe"]).toContain(CURRENCY_INFO[c].gateway);
    }
    // Razorpay is INR-only; every other market bills through Stripe.
    expect(CURRENCY_INFO.INR.gateway).toBe("razorpay");
    expect(CURRENCIES.filter((c) => CURRENCY_INFO[c].gateway === "stripe")).toHaveLength(CURRENCIES.length - 1);
  });

  it("every currency has a strictly increasing plan-price ladder", () => {
    for (const c of CURRENCIES) {
      const ladder = PLANS.map((p) => planPrice(p, c));
      expect(ladder[0]).toBe(0);
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
      }
    }
  });

  it("formats local currencies sensibly", () => {
    expect(formatPlanPrice(249, "AED")).toBe("AED 249");
    expect(formatPlanPrice(349, "BRL")).toBe("R$349");
    expect(formatMoney(55_000, "IDR")).toContain("550");
  });

  it("country presets resolve by dial code", () => {
    expect(presetForDialCode("+971")?.currency).toBe("AED");
    expect(presetForDialCode("+55")?.currency).toBe("BRL");
    expect(presetForDialCode("+62")?.currency).toBe("IDR");
    expect(presetForDialCode("+91")?.currency).toBe("INR");
    expect(presetForDialCode("+999")).toBeNull();
  });
});

describe("verifyStripeWebhook", () => {
  const SECRET = "whsec_test";
  const body = JSON.stringify({ type: "checkout.session.completed" });

  function header(t: number, payload: string = body, secret: string = SECRET) {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(`${t}.${payload}`)
      .digest("hex");
    return `t=${t},v1=${sig}`;
  }

  it("accepts a fresh, correctly signed payload", () => {
    const now = 1_700_000_000;
    expect(verifyStripeWebhook(body, header(now), SECRET, now)).toBe(true);
  });

  it("rejects a stale timestamp (replay defense)", () => {
    const now = 1_700_000_000;
    expect(verifyStripeWebhook(body, header(now - 3600), SECRET, now)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const now = 1_700_000_000;
    expect(verifyStripeWebhook(body + "x", header(now), SECRET, now)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const now = 1_700_000_000;
    expect(
      verifyStripeWebhook(body, header(now, body, "whsec_other"), SECRET, now)
    ).toBe(false);
  });

  it("rejects missing header or secret without throwing", () => {
    const now = 1_700_000_000;
    expect(verifyStripeWebhook(body, null, SECRET, now)).toBe(false);
    expect(verifyStripeWebhook(body, header(now), undefined, now)).toBe(false);
    expect(verifyStripeWebhook(body, "garbage", SECRET, now)).toBe(false);
  });
});
