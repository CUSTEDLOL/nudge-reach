import { describe, expect, it } from "vitest";
import { ACQUISITION_TRIAL_PLAN } from "@/modules/trial/capabilities";

describe("acquisition trial capabilities", () => {
  it("allows no paid or live mutation", () => {
    expect(ACQUISITION_TRIAL_PLAN.limits).toMatchObject({
      automations: 0,
      messagesPerMonth: 0,
      whatsappNumbers: 0,
      aiFrontDesk: false,
      publicApi: false,
      customActions: false,
      byoLlm: false,
      multiNumber: false,
      webWidget: false,
      leadScoring: false,
      voiceAgent: false,
      voiceMinutesPerMonth: 0,
    });
  });
});
