import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  founderActionReady,
  requireReason,
} from "@/modules/admin/confirmation";

describe("confirmationMatches", () => {
  it("matches only the full normalized confirmation", () => {
    expect(confirmationMatches("Glow Clinic", " glow clinic ")).toBe(true);
    expect(confirmationMatches("Glow Clinic", "Glow")).toBe(false);
  });
});

describe("requireReason", () => {
  it("requires a meaningful reason", () => {
    expect(requireReason("  ")).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect(requireReason("ok")).toEqual({
      ok: false,
      error: expect.any(String),
    });
  });

  it("trims an accepted reason and caps its length", () => {
    expect(requireReason("  Owner approved this change.  ")).toEqual({
      ok: true,
      value: "Owner approved this change.",
    });
    expect(requireReason("x".repeat(501))).toEqual({
      ok: false,
      error: expect.any(String),
    });
  });
});

describe("founderActionReady", () => {
  it("blocks confirmation until every requested safeguard is valid", () => {
    expect(
      founderActionReady({
        reasonRequired: true,
        reason: "ok",
        confirmationExpected: "Glow Clinic",
        confirmation: "Glow Clinic",
      })
    ).toBe(false);
    expect(
      founderActionReady({
        reasonRequired: true,
        reason: "Owner approved",
        confirmationExpected: "Glow Clinic",
        confirmation: "Glow",
      })
    ).toBe(false);
    expect(
      founderActionReady({
        reasonRequired: true,
        reason: "Owner approved",
        confirmationExpected: "Glow Clinic",
        confirmation: " glow clinic ",
      })
    ).toBe(true);
  });
});
