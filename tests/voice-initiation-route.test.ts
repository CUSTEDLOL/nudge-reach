import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VOICE_INITIATION_SECRET: "s3cret", SEND_MODE: "live" } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: {
      findUnique: vi.fn(async ({ where }: { where: { phoneE164: string } }) =>
        where.phoneE164 === "+918000000001"
          ? {
              id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "en", voiceId: null,
              transferTo: "+919800000000", enabled: true,
              org: { id: "org1", timezone: "Asia/Kolkata", simulated: false },
            }
          : null
      ),
    },
    org: { findUnique: vi.fn(async () => ({ plan: "front_desk", voiceMinutesOverride: null })) },
    voiceCall: { findMany: vi.fn(async () => []) },
    contact: { findUnique: vi.fn(async () => ({ name: "Priya", phoneE164: "+919876543210" })) },
    knowledgeEntry: { findMany: vi.fn(async () => [{ category: "hours", fact: "Open 9–7", condition: null }]) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({
    enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "",
  })),
}));

import { POST } from "@/app/api/voice/initiation/route";

const req = (body: unknown, secret = "s3cret") =>
  new Request("http://localhost/api/voice/initiation", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-nudge-voice-secret": secret },
  });

describe("POST /api/voice/initiation", () => {
  it("returns per-call config for a known number", async () => {
    const res = await POST(req({ caller_id: "+919876543210", called_number: "+918000000001", agent_id: "a", conversation_id: "c" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dynamic_variables.org_id).toBe("org1");
    expect(json.dynamic_variables.contact_name).toBe("Priya");
    expect(json.conversation_config_override.agent.prompt.prompt).toContain("Open 9–7");
  });
  it("rejects a bad secret and an unknown number", async () => {
    expect((await POST(req({ caller_id: "+91", called_number: "+918000000001" }, "nope"))).status).toBe(401);
    expect((await POST(req({ caller_id: "+91", called_number: "+910000000000" }))).status).toBe(404);
  });
});
