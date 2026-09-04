import type { PostCallTurn, VoiceDriver } from "@/modules/voice/types";

/** A scripted call so test-mode orgs and /demo can "hear" the front desk. */
export const SIM_TRANSCRIPT: PostCallTurn[] = [
  { role: "agent", message: "Hello, you've reached the front desk. How can I help?", t: 0, toolCalls: [] },
  { role: "user", message: "I'd like to book for tomorrow at 5pm, under Priya.", t: 4, toolCalls: [] },
  {
    role: "agent",
    message: "Priya, tomorrow at 5pm — I've noted that. The team will confirm on WhatsApp.",
    t: 9,
    toolCalls: ["capture_booking_request"],
  },
  { role: "user", message: "Great, thanks.", t: 14, toolCalls: [] },
  { role: "agent", message: "You're welcome. Goodbye!", t: 16, toolCalls: ["end_call"] },
];

export const simulationDriver: VoiceDriver = {
  async outboundCall() {
    return { ok: true, providerCallId: `sim_${Math.random().toString(36).slice(2, 10)}` };
  },
};
