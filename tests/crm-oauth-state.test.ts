import { describe, expect, it } from "vitest";
import { signState, verifyState } from "@/modules/crm/oauth-state";

describe("oauth state", () => {
  it("round-trips and rejects tampering", () => {
    const s = signState("org1", "zoho", "k".repeat(32));
    expect(verifyState(s, "k".repeat(32))).toEqual({ orgId: "org1", provider: "zoho" });
    expect(verifyState(Buffer.from(Buffer.from(s, "base64url").toString("utf8").replace("org1", "org2")).toString("base64url"), "k".repeat(32))).toBeNull();
    expect(verifyState(s, "x".repeat(32))).toBeNull();
    expect(verifyState("garbage", "k".repeat(32))).toBeNull();
  });
});
