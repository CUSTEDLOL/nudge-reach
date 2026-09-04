import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { ELEVENLABS_WEBHOOK_SECRET: "whsec", SEND_MODE: "live" } }));
const fileCall = vi.hoisted(() =>
  vi.fn(async () => ({ voiceCallId: "vc", conversationId: "cv", contactId: "c" }))
);
vi.mock("@/modules/voice/file-call", () => ({ fileCall }));
vi.mock("@/lib/db", () => ({
  prisma: { voiceNumber: { findUnique: vi.fn(async () => ({ orgId: "org1" })) } },
}));

import { POST } from "@/app/api/voice/post-call/route";

const body = JSON.stringify({
  type: "post_call_transcription",
  data: {
    agent_id: "a",
    conversation_id: "conv_9",
    transcript: [{ role: "user", message: "hi", time_in_call_secs: 1 }],
    metadata: {
      call_duration_secs: 12,
      phone_call: { direction: "inbound", external_number: "+919876543210", agent_number: "+918000000001" },
    },
    analysis: { transcript_summary: "s", call_successful: "success" },
    dynamic_variables: { org_id: "org1", purpose: "inbound" },
  },
});
const signed = (b: string, secret = "whsec") => {
  const t = Math.floor(Date.now() / 1000);
  const v0 = crypto.createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");
  return new Request("http://localhost/api/voice/post-call", {
    method: "POST",
    body: b,
    headers: { "elevenlabs-signature": `t=${t},v0=${v0}` },
  });
};

describe("POST /api/voice/post-call", () => {
  it("files a signed transcription for the org that owns the dialled number", async () => {
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    expect(fileCall).toHaveBeenCalledWith("org1", expect.objectContaining({ providerCallId: "conv_9" }), "inbound");
  });
  it("rejects a bad signature", async () => {
    expect((await POST(signed(body, "wrong"))).status).toBe(401);
  });
});
