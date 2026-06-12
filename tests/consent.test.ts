import { describe, expect, it } from "vitest";
import { canSendMarketing } from "@/lib/consent";

describe("canSendMarketing (rule 2: consent gate)", () => {
  it("allows an opted-in contact who never opted out", () => {
    expect(canSendMarketing({ optedIn: true, optedOutAt: null })).toBe(true);
  });

  it("blocks a contact who never opted in", () => {
    expect(canSendMarketing({ optedIn: false, optedOutAt: null })).toBe(false);
  });

  it("blocks a contact who opted out — permanently, even if optedIn is still true", () => {
    expect(
      canSendMarketing({ optedIn: true, optedOutAt: new Date("2026-01-01") })
    ).toBe(false);
  });

  it("blocks when both flags say no", () => {
    expect(
      canSendMarketing({ optedIn: false, optedOutAt: new Date() })
    ).toBe(false);
  });

  it("treats truthy-but-not-true optedIn as no (defensive against bad casts)", () => {
    expect(
      canSendMarketing({
        optedIn: "yes" as unknown as boolean,
        optedOutAt: null,
      })
    ).toBe(false);
  });
});
