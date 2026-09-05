import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({ env: { VOICE_INITIATION_SECRET: "s3cret", SEND_MODE: "live" } }));

const state = vi.hoisted(() => ({ plan: "front_desk", override: null as number | null, callSecs: [] as number[] }));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: {
      findFirst: vi.fn(async ({ where }: { where: { phoneE164: string } }) =>
        where.phoneE164 === "+918000000001"
          ? {
              id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "en", voiceId: null,
              transferTo: null, enabled: true,
              org: { id: "org1", timezone: "Asia/Kolkata", simulated: false },
            }
          : null
      ),
    },
    org: {
      findUnique: vi.fn(async ({ select }: { select?: Record<string, boolean> }) =>
        select?.plan
          ? { plan: state.plan, voiceMinutesOverride: state.override }
          : { id: "org1", timezone: "Asia/Kolkata" }
      ),
    },
    voiceCall: { findMany: vi.fn(async () => state.callSecs.map((s) => ({ durationSecs: s }))) },
    contact: { findUnique: vi.fn(async () => null) },
    knowledgeEntry: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({
    enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "",
  })),
}));

import { POST } from "@/app/api/voice/initiation/route";

const ring = () =>
  POST(
    new Request("http://localhost/api/voice/initiation", {
      method: "POST",
      body: JSON.stringify({ caller_id: "+919876543210", called_number: "+918000000001" }),
      headers: { "content-type": "application/json", "x-nudge-voice-secret": "s3cret" },
    })
  );

beforeEach(() => {
  state.plan = "front_desk";
  state.override = null;
  state.callSecs = [];
});

describe("call-minute cutoff at the initiation webhook", () => {
  it("answers while minutes remain", async () => {
    state.callSecs = [60 * 50]; // 50 of 100 minutes used
    const res = await ring();
    expect(res.status).toBe(200);
    expect((await res.json()).dynamic_variables.org_id).toBe("org1");
  });

  it("refuses once the package's minutes are gone — the call never connects", async () => {
    state.callSecs = Array.from({ length: 100 }, () => 60); // 100 of 100
    const res = await ring();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toMatch(/minutes/i);
    expect(body.conversation_config_override).toBeUndefined();
  });

  it("counts part-minutes as whole minutes", async () => {
    state.callSecs = Array.from({ length: 100 }, () => 5); // 100 × 5s → 100 minutes
    expect((await ring()).status).toBe(402);
  });

  it("a founder override raises the ceiling without a plan change", async () => {
    state.callSecs = Array.from({ length: 100 }, () => 60);
    state.override = 300;
    expect((await ring()).status).toBe(200);
  });

  it("an unlimited allowance never blocks", async () => {
    state.plan = "enterprise";
    state.callSecs = Array.from({ length: 5000 }, () => 60);
    expect((await ring()).status).toBe(200);
  });
});
