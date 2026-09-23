import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/**
 * The rule cap has to be the SAME number on every channel a workspace has.
 *
 * The WhatsApp path derived it (`isRestrictedAcquisitionTrial ? trial : full`);
 * the three voice call sites took `MAX_ACTIVE_RULES.full` outright, each with a
 * comment explaining that no acquisition trial carries the `voiceAgent`
 * capability. That is a fact about today's plan table, not about this code — a
 * trial plan gaining voice would have given one workspace 20 rules on the phone
 * and 5 in chat, silently. This file pins the derivation instead of the comment.
 */

const { state, ruleQueries } = vi.hoisted(() => ({
  ruleQueries: [] as Record<string, unknown>[],
  state: { trial: null as null | { convertedAt: Date | null; org: { subscriptionStatus: string } } },
}));

vi.mock("@/lib/env", () => ({
  env: { VOICE_INITIATION_SECRET: "s3cret", VOICE_TOOLS_SECRET: "tool-secret", SEND_MODE: "live" },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    voiceNumber: {
      findFirst: vi.fn(async ({ where }: { where: { phoneE164: string } }) =>
        where.phoneE164 === "+918000000001"
          ? {
              id: "vn1", orgId: "org1", phoneE164: "+918000000001", language: "en",
              voiceId: null, transferTo: null, enabled: true,
            }
          : null
      ),
    },
    org: { findUnique: vi.fn(async () => ({ id: "org1", timezone: "Asia/Kolkata", plan: "front_desk", voiceMinutesOverride: null })) },
    voiceCall: { findMany: vi.fn(async () => []) },
    contact: { findUnique: vi.fn(async () => null) },
    knowledgeEntry: { findMany: vi.fn(async () => []) },
    agentRule: {
      findMany: vi.fn(async (args: Record<string, unknown>) => {
        ruleQueries.push(args);
        return [{ instruction: "Always offer the evening slot first" }];
      }),
    },
    acquisitionTrial: { findUnique: vi.fn(async () => state.trial) },
  },
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn(async () => ({
    enabled: true, vertical: "clinic", businessName: "BrightSmile", businessInfo: "", tone: "Warm", doNots: "",
  })),
}));

import { POST } from "@/app/api/voice/initiation/route";
import { MAX_ACTIVE_RULES } from "@/modules/agent/rules";
import { activeRulesForOrg, ruleLimitFor } from "@/modules/agent/rules-store";

const call = () =>
  POST(
    new Request("http://localhost/api/voice/initiation", {
      method: "POST",
      body: JSON.stringify({ caller_id: "+919876543210", called_number: "+918000000001" }),
      headers: { "content-type": "application/json", "x-nudge-voice-secret": "s3cret" },
    })
  );

const UNCONVERTED_TRIAL = { convertedAt: null, org: { subscriptionStatus: "trialing" } };

describe("the dialled-number webhook takes the workspace's own rule limit", () => {
  it("gives an unconverted trial the trial cap, not the full one", async () => {
    ruleQueries.length = 0;
    state.trial = UNCONVERTED_TRIAL;

    const res = await call();

    expect(res.status).toBe(200);
    expect(ruleQueries).toHaveLength(1);
    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.trial);
    expect(ruleQueries[0].take).not.toBe(MAX_ACTIVE_RULES.full);
  });

  it("still gives a paying workspace the full cap", async () => {
    ruleQueries.length = 0;
    state.trial = null;

    expect((await call()).status).toBe(200);
    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.full);
  });

  it("a converted trial is no longer restricted", async () => {
    ruleQueries.length = 0;
    state.trial = { convertedAt: new Date(), org: { subscriptionStatus: "trialing" } };

    await call();
    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.full);
  });
});

describe("ruleLimitFor / activeRulesForOrg (the one place the limit is chosen)", () => {
  it("reads the trial cap for an unconverted trial and the full cap otherwise", async () => {
    state.trial = UNCONVERTED_TRIAL;
    expect(await ruleLimitFor("org1")).toBe(MAX_ACTIVE_RULES.trial);
    state.trial = null;
    expect(await ruleLimitFor("org1")).toBe(MAX_ACTIVE_RULES.full);
  });

  it("passes that limit to the org-scoped read (invariant #5)", async () => {
    ruleQueries.length = 0;
    state.trial = UNCONVERTED_TRIAL;

    await activeRulesForOrg("org-other");

    expect(ruleQueries[0]).toMatchObject({
      where: { orgId: "org-other", status: "active" },
      take: MAX_ACTIVE_RULES.trial,
    });
  });
});

/**
 * The dialled-number webhook above is exercised end-to-end. The browser test
 * call and the outbound reminder tick reach `activeRulesForOrg` through the
 * same one-line call, and standing their whole world up a second time would
 * assert the helper, not the wiring — so the wiring is read from the source.
 * This is the assertion that fails if someone writes `MAX_ACTIVE_RULES.full`
 * back into a voice path.
 */
describe("every voice call site derives the limit rather than naming it", () => {
  const VOICE_SITES = [
    "src/app/api/voice/initiation/route.ts",
    "src/app/(app)/agent/voice/actions.ts",
    "src/modules/voice/reminder-calls.ts",
  ];

  for (const file of VOICE_SITES) {
    it(`${file} calls activeRulesForOrg and never MAX_ACTIVE_RULES.full`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("activeRulesForOrg(");
      // Comments explain the history and may name it; code must not.
      const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code).not.toContain("MAX_ACTIVE_RULES");
    });
  }
});
