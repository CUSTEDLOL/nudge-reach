import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", ELEVENLABS_API_KEY: "k", ELEVENLABS_AGENT_ID: "agent_1" },
}));

import { verifyElevenLabsSignature, elevenLabsDriver } from "@/modules/voice/drivers/elevenlabs";
import { simulationDriver } from "@/modules/voice/drivers/simulation";
import { voiceDriverFor } from "@/modules/voice";

const secret = "whsec_test";
const body = '{"type":"post_call_transcription"}';
const sign = (t: number) =>
  `t=${t},v0=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("verifyElevenLabsSignature", () => {
  it("accepts a fresh, correctly signed body", () => {
    expect(verifyElevenLabsSignature(body, sign(1000), secret, 1010)).toBe(true);
  });
  it("rejects tampered bodies, wrong secrets and stale timestamps", () => {
    expect(verifyElevenLabsSignature(body + " ", sign(1000), secret, 1010)).toBe(false);
    expect(verifyElevenLabsSignature(body, sign(1000), "other", 1010)).toBe(false);
    expect(verifyElevenLabsSignature(body, sign(1000), secret, 1000 + 40 * 60)).toBe(false);
    expect(verifyElevenLabsSignature(body, null, secret, 1010)).toBe(false);
  });
});

const init = {
  dynamic_variables: { org_id: "o" },
  conversation_config_override: { agent: { prompt: { prompt: "p" }, first_message: "hi", language: "en" } },
};

describe("drivers", () => {
  it("simulation driver returns a fake call id without network", async () => {
    const r = await simulationDriver.outboundCall({ agentPhoneNumberId: "sim", toE164: "+919876543210", init });
    expect(r.ok).toBe(true);
    expect(r.providerCallId).toMatch(/^sim_/);
  });

  it("elevenlabs driver posts to the sip-trunk outbound endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, conversation_id: "conv_1" }), { status: 200 })
    );
    const r = await elevenLabsDriver.outboundCall({ agentPhoneNumberId: "pn_1", toE164: "+919876543210", init });
    expect(r).toEqual({ ok: true, providerCallId: "conv_1" });
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call");
    const sent = JSON.parse(String((opts as RequestInit).body));
    expect(sent.agent_id).toBe("agent_1");
    expect(sent.agent_phone_number_id).toBe("pn_1");
    expect(sent.to_number).toBe("+919876543210");
    expect(sent.conversation_initiation_client_data.dynamic_variables.org_id).toBe("o");
    fetchSpy.mockRestore();
  });

  it("picks the simulation driver for simulated orgs", () => {
    expect(voiceDriverFor({ simulated: true })).toBe(simulationDriver);
    expect(voiceDriverFor({ simulated: false })).toBe(elevenLabsDriver);
  });
});
