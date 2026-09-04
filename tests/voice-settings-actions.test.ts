import { describe, expect, it } from "vitest";
import { parseVoiceNumberForm } from "@/app/(app)/settings/voice/validate";

describe("parseVoiceNumberForm", () => {
  it("normalises phone numbers and defaults", () => {
    const fd = new FormData();
    fd.set("phoneE164", "91 80000 00001");
    fd.set("provider", "exotel");
    fd.set("transferTo", "+91 98000 00000");
    expect(parseVoiceNumberForm(fd)).toEqual({
      phoneE164: "+918000000001",
      provider: "exotel",
      label: "Main line",
      transferTo: "+919800000000",
      language: "en",
      voiceId: null,
      elevenPhoneId: null,
    });
  });
  it("rejects bad providers and languages", () => {
    const fd = new FormData();
    fd.set("phoneE164", "+918000000001");
    fd.set("provider", "skype");
    expect(() => parseVoiceNumberForm(fd)).toThrow(/provider/);
  });
});
