import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { VoiceDriver } from "@/modules/voice/types";

/**
 * ElevenLabs Agents — the live voice driver. Outbound calls go through the
 * SIP-trunk endpoint (Exotel in India, any SIP carrier elsewhere); inbound
 * calls never touch this file (they arrive as webhooks).
 */

const API = "https://api.elevenlabs.io/v1";
/** Post-call webhooks older than this are replays. */
const TOLERANCE_SECS = 30 * 60;

/** Header format: `t=<unix>,v0=<hex hmac-sha256 of "<t>.<body>">`. */
export function verifyElevenLabsSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSecs: number = Math.floor(Date.now() / 1000)
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = Number(parts.t);
  const v0 = parts.v0 ?? "";
  if (!Number.isFinite(t) || Math.abs(nowSecs - t) > TOLERANCE_SECS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (expected.length !== v0.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v0, "hex"));
}

export const elevenLabsDriver: VoiceDriver = {
  async outboundCall({ agentPhoneNumberId, toE164, init }) {
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_AGENT_ID) {
      return { ok: false, error: "ElevenLabs is not configured" };
    }
    const res = await fetch(`${API}/convai/sip-trunk/outbound-call`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        agent_id: env.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: agentPhoneNumberId,
        to_number: toE164,
        conversation_initiation_client_data: init,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      conversation_id?: string | null;
      message?: string;
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, providerCallId: json.conversation_id ?? undefined };
  },
};
