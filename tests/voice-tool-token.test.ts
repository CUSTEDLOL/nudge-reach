import { describe, expect, it } from "vitest";
import { createVoiceToolToken, verifyVoiceToolToken } from "@/modules/voice/tool-token";

const scope = { orgId: "org1", contactPhone: "+919876543210", source: "phone" as const };

describe("voice tool token", () => {
  it("accepts the exact call scope before expiry", () => {
    const token = createVoiceToolToken(scope, "secret", 1_000);
    expect(verifyVoiceToolToken(token, scope, "secret", 1_899)).toBe(true);
  });

  it("rejects expiry and changes to tenant, caller or source", () => {
    const token = createVoiceToolToken(scope, "secret", 1_000);
    expect(verifyVoiceToolToken(token, scope, "secret", 1_901)).toBe(false);
    expect(verifyVoiceToolToken(token, scope, "secret", 1_901, 60)).toBe(true);
    expect(verifyVoiceToolToken(token, { ...scope, orgId: "org2" }, "secret", 1_100)).toBe(false);
    expect(verifyVoiceToolToken(token, { ...scope, contactPhone: "+911" }, "secret", 1_100)).toBe(false);
    expect(verifyVoiceToolToken(token, { ...scope, source: "browser" }, "secret", 1_100)).toBe(false);
  });
});
