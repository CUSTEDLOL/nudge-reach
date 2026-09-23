import { describe, expect, it, vi } from "vitest";

/**
 * The initiation webhook serves phone calls only. A browser "Call your AI"
 * session never comes through here: the settings page builds the workspace's
 * own prompt and a signed tool token and hands them to the browser directly
 * (verified against ElevenLabs on 2026-09-15 — a js_sdk session runs on the
 * client's overrides and variables). So a request with no dialled number has
 * no tenant, and the route must refuse rather than guess one.
 */

vi.mock("@/lib/env", () => ({
  env: {
    get VOICE_INITIATION_SECRET() { return "s3cret"; },
    VOICE_TOOLS_SECRET: "tool-secret",
    SEND_MODE: "live",
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async ({ where }: { where: { phoneE164?: string } }) =>
        where.phoneE164 === "+918000000001"
          ? {
              id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "hi",
              voiceId: "v1", transferTo: "+919800000000", enabled: true,
            }
          : null
      ),
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
    agentRule: { findMany: vi.fn(async () => [{ instruction: "Always offer the evening slot first" }]) },
    // The voice paths now derive the rule limit from the workspace
    // (`ruleLimitFor`) instead of taking `MAX_ACTIVE_RULES.full` outright.
    // No row means no acquisition trial: a full workspace, as before.
    acquisitionTrial: { findUnique: vi.fn(async () => null) },
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

describe("initiation webhook tenant resolution", () => {
  it("refuses a request with no dialled number — never guesses a tenant", async () => {
    expect((await ring({ agent_id: "a", conversation_id: "c" })).status).toBe(404);
    expect((await ring({ caller_id: "+919876543210", agent_id: "a" })).status).toBe(404);
  });

  it("serves the business behind the dialled number, with that line's settings", async () => {
    const res = await ring({ caller_id: "+919876543210", called_number: "+918000000001", agent_id: "a" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dynamic_variables.org_id).toBe("org1");
    expect(json.dynamic_variables.call_source).toBe("phone");
    expect(json.conversation_config_override.agent.prompt.prompt).toContain("Open 9–7");
    expect(json.conversation_config_override.agent.prompt.prompt).toContain(
      "Always offer the evening slot first"
    );
    expect(json.conversation_config_override.agent.language).toBe("hi");
    expect(json.conversation_config_override.tts).toEqual({ voice_id: "v1" });
  });
});
