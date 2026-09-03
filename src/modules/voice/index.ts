import { env } from "@/lib/env";
import { elevenLabsDriver } from "@/modules/voice/drivers/elevenlabs";
import { simulationDriver } from "@/modules/voice/drivers/simulation";
import type { VoiceDriver } from "@/modules/voice/types";

export type { CallInit, CallInitInput, PostCall, PostCallTurn, VoiceDriver } from "@/modules/voice/types";

/**
 * Same rule as messaging (invariant #4): the global simulation switch wins,
 * a simulated org stays mocked, and without ElevenLabs keys nothing can leave.
 */
export function voiceDriverFor(org: { simulated: boolean }): VoiceDriver {
  if (env.SEND_MODE === "simulation" || org.simulated || !env.ELEVENLABS_API_KEY) {
    return simulationDriver;
  }
  return elevenLabsDriver;
}
