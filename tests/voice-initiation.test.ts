import { describe, expect, it } from "vitest";
import { buildCallInit } from "@/modules/voice/initiation";

const base = {
  org: { id: "org1", timezone: "Asia/Kolkata" },
  number: { phoneE164: "+918000000001", language: "en", voiceId: null, transferTo: "+919800000000" },
  profile: { vertical: "clinic", businessName: "BrightSmile Dental", businessInfo: "", tone: "Warm", doNots: "" },
  knowledgeDigest: "- Hours: Mon–Sat 9am–7pm\n- Consultation ₹500",
  contact: { name: "+919876543210", phoneE164: "+919876543210" },
  purpose: "inbound" as const,
  now: new Date("2026-09-01T04:30:00Z"),
};

describe("buildCallInit", () => {
  it("greets as the business, carries the knowledge digest and tenant ids", () => {
    const init = buildCallInit(base);
    expect(init.conversation_config_override.agent.first_message).toContain("BrightSmile Dental");
    expect(init.conversation_config_override.agent.prompt.prompt).toContain("Consultation ₹500");
    expect(init.conversation_config_override.agent.prompt.prompt).toContain("You are on a phone call");
    expect(init.dynamic_variables.org_id).toBe("org1");
    expect(init.dynamic_variables.contact_phone).toBe("+919876543210");
    expect(init.dynamic_variables.transfer_to).toBe("+919800000000");
    expect(init.conversation_config_override.agent.language).toBe("en");
    expect(init.conversation_config_override.tts).toBeUndefined();
  });

  it("uses Hindi + the configured voice and a reminder opener for reminder calls", () => {
    const init = buildCallInit({
      ...base,
      number: { ...base.number, language: "hi", voiceId: "voice_123" },
      purpose: "reminder",
      booking: { requestedFor: "tomorrow 5pm", name: "Rahul" },
    });
    expect(init.conversation_config_override.agent.language).toBe("hi");
    expect(init.conversation_config_override.tts).toEqual({ voice_id: "voice_123" });
    expect(init.conversation_config_override.agent.first_message).toContain("Rahul");
    expect(init.conversation_config_override.agent.first_message).toContain("tomorrow 5pm");
  });
});
