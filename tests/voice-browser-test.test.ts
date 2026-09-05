import { describe, expect, it, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ testOrg: "org1" as string | undefined }));
vi.mock("@/lib/env", () => ({
  env: {
    get VOICE_INITIATION_SECRET() { return "s3cret"; },
    get VOICE_TEST_ORG_ID() { return state.testOrg; },
    SEND_MODE: "live",
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => ({
        id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "hi",
        voiceId: "v1", transferTo: "+919800000000", enabled: true,
      })),
    },
    org: {
      findUnique: vi.fn(async ({ select }: { select?: Record<string, boolean> }) =>
        select?.plan
          ? { plan: "front_desk", voiceMinutesOverride: null }
          : { id: "org1", timezone: "Asia/Kolkata", simulated: false }
      ),
    },
    voiceCall: { findMany: vi.fn(async () => []) },
    contact: { findUnique: vi.fn(async () => null) },
    knowledgeEntry: { findMany: vi.fn(async () => [{ category: "hours", fact: "Open 9–7", condition: null }]) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({
    enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "",
  })),
}));

import { POST } from "@/app/api/voice/initiation/route";

const ring = (body: unknown) =>
  POST(new Request("http://localhost/api/voice/initiation", {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-nudge-voice-secret": "s3cret" },
  }));

beforeEach(() => { state.testOrg = "org1"; });

describe("browser / no-phone conversations", () => {
  it("serves the configured test workspace when there is no dialled number", async () => {
    const res = await ring({ agent_id: "a", conversation_id: "c" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dynamic_variables.org_id).toBe("org1");
    expect(json.conversation_config_override.agent.prompt.prompt).toContain("Open 9–7");
    // it borrows the org's own number settings so the test sounds like the real line
    expect(json.conversation_config_override.agent.language).toBe("hi");
    expect(json.conversation_config_override.tts).toEqual({ voice_id: "v1" });
  });

  it("refuses when no test workspace is configured — never guesses a tenant", async () => {
    state.testOrg = undefined;
    expect((await ring({ agent_id: "a" })).status).toBe(404);
  });
});
