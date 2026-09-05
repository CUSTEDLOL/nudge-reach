import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt, TOOL_GUIDANCE } from "@/modules/agent/prompt";

const profile = { vertical: "clinic", businessName: "BrightSmile Dental", businessInfo: "", tone: "Warm", doNots: "" };

describe("voice channel prompt", () => {
  const voice = buildAgentSystemPrompt(profile, { withTools: true, channel: "voice", canTransfer: true });
  const chat = buildAgentSystemPrompt(profile, { withTools: true });

  it("introduces itself as the phone assistant, never the WhatsApp one", () => {
    expect(voice).toContain("phone assistant");
    expect(voice).toContain("live phone call");
    expect(voice).not.toContain("WhatsApp assistant");
    expect(chat).toContain("WhatsApp assistant");
  });

  it("speaks: no emojis, no markdown, no URLs, numbers in words, digits read back", () => {
    for (const rule of ["no emojis", "no markdown", "Never read out a web link", "digit by digit", "in words"]) {
      expect(voice).toContain(rule);
    }
  });

  it("swaps the chat-only tool advice for phone behaviour", () => {
    expect(voice).not.toContain("handoff_to_human");
    expect(voice).toContain("transfer_to_number");
    expect(voice).toContain("end_call");
    expect(voice).not.toContain("send_payment_link");
    expect(voice).not.toContain("sent to their WhatsApp");
    expect(voice).toContain("approved payment details");
    // the chat prompt is untouched
    expect(chat).toContain("handoff_to_human");
    expect(chat).toContain(TOOL_GUIDANCE);
  });

  it("tells the agent to take a message when no transfer number exists", () => {
    const noTransfer = buildAgentSystemPrompt(profile, { withTools: true, channel: "voice", canTransfer: false });
    expect(noTransfer).toContain("no one can take the call now");
    expect(noTransfer).not.toContain("call `transfer_to_number`");
  });
});
