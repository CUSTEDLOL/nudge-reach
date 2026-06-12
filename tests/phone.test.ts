import { describe, expect, it } from "vitest";
import { normalizePhoneE164 } from "@/lib/phone";

describe("normalizePhoneE164", () => {
  it("keeps valid E.164 as-is", () => {
    expect(normalizePhoneE164("+919876543210")).toBe("+919876543210");
  });
  it("assumes +91 for bare 10-digit Indian numbers", () => {
    expect(normalizePhoneE164("98765 43210")).toBe("+919876543210");
  });
  it("handles 91-prefixed and 0-prefixed forms", () => {
    expect(normalizePhoneE164("919876543210")).toBe("+919876543210");
    expect(normalizePhoneE164("09876543210")).toBe("+919876543210");
  });
  it("rejects garbage", () => {
    expect(normalizePhoneE164("hello")).toBeNull();
    expect(normalizePhoneE164("123")).toBeNull();
  });
});
