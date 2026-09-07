import { describe, expect, it } from "vitest";
import { isFounderEmail } from "@/modules/admin/auth";

/**
 * Founder-panel gate (docs/plans/2026-09-05-admin-panel.md). The rule that
 * matters most: with no FOUNDER_EMAILS configured the panel is OFF for
 * everyone — it fails closed, never open.
 */
describe("isFounderEmail", () => {
  const LIST = "vishesh@example.com, Dhairya@Example.com";

  it("fails closed when the allowlist is unset or empty", () => {
    expect(isFounderEmail("vishesh@example.com", undefined)).toBe(false);
    expect(isFounderEmail("vishesh@example.com", "")).toBe(false);
    expect(isFounderEmail("vishesh@example.com", "  ,  ,")).toBe(false);
  });

  it("matches listed emails case-insensitively, ignoring whitespace", () => {
    expect(isFounderEmail("vishesh@example.com", LIST)).toBe(true);
    expect(isFounderEmail("VISHESH@EXAMPLE.COM", LIST)).toBe(true);
    expect(isFounderEmail("dhairya@example.com", LIST)).toBe(true);
  });

  it("rejects everyone else, including near-misses and empty emails", () => {
    expect(isFounderEmail("customer@example.com", LIST)).toBe(false);
    expect(isFounderEmail("vishesh@example.co", LIST)).toBe(false);
    expect(isFounderEmail("", LIST)).toBe(false);
    expect(isFounderEmail(undefined, LIST)).toBe(false);
  });
});
