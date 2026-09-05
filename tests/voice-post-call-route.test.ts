import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { ELEVENLABS_WEBHOOK_SECRET: "whsec", VOICE_TOOLS_SECRET: "tool-secret", SEND_MODE: "live" } }));
const fileCall = vi.hoisted(() =>
  vi.fn(async () => ({ voiceCallId: "vc", conversationId: "cv", contactId: "c" }))
);
const state = vi.hoisted(() => ({ numberOwned: true }));
vi.mock("@/modules/voice/file-call", () => ({ fileCall }));
vi.mock("@/lib/db", () => ({
  prisma: { voiceNumber: { findUnique: vi.fn(async () => state.numberOwned ? ({ orgId: "org1" }) : null) } },
}));

import { POST } from "@/app/api/voice/post-call/route";
import { createVoiceToolToken } from "@/modules/voice/tool-token";

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

beforeEach(() => {
  state.numberOwned = true;
  fileCall.mockClear();
});

describe("POST /api/voice/post-call", () => {
  it("files a signed transcription for the org that owns the dialled number", async () => {
    const res = await POST(signed(body));
    expect(res.status).toBe(200);
    expect(fileCall).toHaveBeenCalledWith("org1", expect.objectContaining({ providerCallId: "conv_9" }), "inbound", "phone");
  });
  it("rejects a bad signature", async () => {
    expect((await POST(signed(body, "wrong"))).status).toBe(401);
  });

  it("accepts a browser transcript only with tenant-scoped call context", async () => {
    state.numberOwned = false;
    const caller = "+999000000000";
    const token = createVoiceToolToken(
      { orgId: "org1", contactPhone: caller, source: "browser" },
      "tool-secret"
    );
    const browserBody = JSON.stringify({
      type: "post_call_transcription",
      data: {
        agent_id: "a",
        conversation_id: "browser_1",
        transcript: [{ role: "user", message: "hi", time_in_call_secs: 1 }],
        metadata: { call_duration_secs: 5 },
        dynamic_variables: {
          org_id: "org1",
          contact_phone: caller,
          call_source: "browser",
          tool_token: token,
          purpose: "inbound",
        },
      },
    });
    expect((await POST(signed(browserBody))).status).toBe(200);
    expect(fileCall).toHaveBeenLastCalledWith(
      "org1",
      expect.objectContaining({ providerCallId: "browser_1" }),
      "inbound",
      "browser"
    );

    fileCall.mockClear();
    const tampered = browserBody.replace('"org_id":"org1"', '"org_id":"org2"');
    expect((await POST(signed(tampered))).status).toBe(200);
    expect(fileCall).not.toHaveBeenCalled();
    state.numberOwned = true;
  });
});
