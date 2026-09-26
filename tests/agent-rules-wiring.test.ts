import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * House rules only earn their keep if they reach EVERY prompt the customer's
 * words ever hit. Task 3 built the block; this file pins the wiring, because
 * the failure it guards against is silent: a channel that never loads the
 * rules simply goes on ignoring the owner, with nothing in the logs to say so.
 *
 * Covered here: the loader itself (org-scoped, invariant #5), the WhatsApp
 * reply path, the voice call-init, and the inbox's suggested replies.
 */

const {
  prisma,
  envState,
  chat,
  runAgent,
  ensureAgentProfile,
  isRestrictedAcquisitionTrial,
  sendMessage,
  promptCalls,
  ruleRows,
  ruleQueries,
} = vi.hoisted(() => ({
  promptCalls: [] as { options: Record<string, unknown> }[],
  ruleRows: [] as { instruction: string }[],
  ruleQueries: [] as Record<string, unknown>[],
  envState: { ANTHROPIC_API_KEY: "sk-test", SEND_MODE: "simulation" },
  prisma: {
    agentRule: { findMany: vi.fn() },
    contact: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    conversation: { upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    conversationMessage: { create: vi.fn(), findMany: vi.fn() },
    org: { findUnique: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
    agentProfile: { findUnique: vi.fn() },
  },
  chat: vi.fn(),
  runAgent: vi.fn(),
  ensureAgentProfile: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ chat, runAgent, generate: vi.fn() }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage }));
vi.mock("@/modules/agent/profile", () => ({ ensureAgentProfile }));
vi.mock("@/modules/agent/tools/custom", () => ({
  loadCustomTools: vi.fn(async () => []),
}));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/crm/events", () => ({ crmContactCreated: vi.fn() }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/scoring/compute", () => ({ scoreContactSoon: vi.fn() }));
vi.mock("@/modules/automation/engine", () => ({
  runInboundAutomations: vi.fn(async () => ({ replied: false })),
  cancelWaitingRuns: vi.fn(async () => 0),
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  dispatchWebhook: vi.fn(),
}));

// Spy on the real builder: the assertion is about the options it RECEIVES, so
// the prompt it returns must stay genuine.
vi.mock("@/modules/agent/prompt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/agent/prompt")>();
  return {
    ...actual,
    buildAgentSystemPrompt: (
      profile: Parameters<typeof actual.buildAgentSystemPrompt>[0],
      options: Parameters<typeof actual.buildAgentSystemPrompt>[1] = {}
    ) => {
      promptCalls.push({ options: options as Record<string, unknown> });
      return actual.buildAgentSystemPrompt(profile, options);
    },
    // WhatsApp replies take the cache-split variant; voice keeps the above.
    buildAgentPromptParts: (
      profile: Parameters<typeof actual.buildAgentPromptParts>[0],
      options: Parameters<typeof actual.buildAgentPromptParts>[1] = {}
    ) => {
      promptCalls.push({ options: options as Record<string, unknown> });
      return actual.buildAgentPromptParts(profile, options);
    },
  };
});

import { MAX_ACTIVE_RULES, renderRulesBlock } from "@/modules/agent/rules";
import { activeRules } from "@/modules/agent/rules-store";
import { handleInboundMessage } from "@/modules/agent/inbound";
import { buildCallInit } from "@/modules/voice/initiation";
import { buildSuggestSystemPrompt, suggestReply } from "@/modules/ai/suggest-reply";

const RULES = [
  { instruction: "Always point people to the waitlist at https://getgutfeeling.in/" },
  { instruction: "Never quote a price; offer a consultation instead" },
];

const PROFILE = {
  enabled: true,
  vertical: "clinic",
  businessName: "Gut Feeling",
  businessInfo: "Legacy blob.",
  tone: "Warm",
  doNots: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  promptCalls.length = 0;
  ruleQueries.length = 0;
  ruleRows.splice(0, ruleRows.length, ...RULES);

  prisma.agentRule.findMany.mockImplementation(async (args: Record<string, unknown>) => {
    ruleQueries.push(args);
    return ruleRows.map((r) => ({ ...r }));
  });
  prisma.contact.findUnique.mockResolvedValue({ id: "c1" });
  prisma.contact.upsert.mockResolvedValue({
    id: "c1",
    name: "Priya",
    phoneE164: "+919876543210",
    optedIn: true,
    optedOutAt: null,
  });
  prisma.contact.update.mockResolvedValue({});
  prisma.conversation.upsert.mockResolvedValue({ id: "conv1", whatsappAccountId: null });
  prisma.conversation.update.mockResolvedValue({});
  prisma.conversationMessage.create.mockResolvedValue({});
  prisma.conversationMessage.findMany.mockResolvedValue([
    { direction: "inbound", body: "do you do hair transplants?" },
  ]);
  prisma.org.findUnique.mockResolvedValue({ timezone: "Asia/Kolkata" });
  prisma.knowledgeEntry.findMany.mockResolvedValue([
    { category: "services", fact: "Consult ₹500", condition: null },
  ]);
  prisma.agentProfile.findUnique.mockResolvedValue(PROFILE);
  ensureAgentProfile.mockResolvedValue(PROFILE);
  isRestrictedAcquisitionTrial.mockResolvedValue(false);
  sendMessage.mockResolvedValue({ providerMessageId: "wamid.1" });
  chat.mockResolvedValue("Sure — here's the waitlist.");
  runAgent.mockResolvedValue({ text: "Sure — here's the waitlist.", toolCalls: [] });
});

describe("activeRules (the only AgentRule read on the reply path)", () => {
  it("asks for one org's active rules, in the order the owner arranged them", async () => {
    await activeRules("org1", MAX_ACTIVE_RULES.full);

    expect(ruleQueries[0]).toEqual({
      where: { orgId: "org1", status: "active" },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: MAX_ACTIVE_RULES.full,
      select: { instruction: true },
    });
  });

  it("honours the limit it is given", async () => {
    await activeRules("org1", MAX_ACTIVE_RULES.trial);
    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.trial);
  });

  it("never reads another workspace's rules (invariant #5)", async () => {
    await activeRules("org-other", MAX_ACTIVE_RULES.full);
    expect(ruleQueries[0].where).toEqual({ orgId: "org-other", status: "active" });
  });
});

describe("WhatsApp — handleInboundMessage", () => {
  it("hands the org's house rules to the agent prompt", async () => {
    await handleInboundMessage("org1", "919876543210", "hi");

    expect(promptCalls).toHaveLength(1);
    expect(promptCalls[0].options.rules).toEqual(RULES);
  });

  it("reads the rules of the org whose message it is answering", async () => {
    await handleInboundMessage("org-b", "919876543210", "hi");
    expect(ruleQueries[0].where).toEqual({ orgId: "org-b", status: "active" });
  });

  it("caps a full workspace at the full allowance", async () => {
    await handleInboundMessage("org1", "919876543210", "hi");
    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.full);
  });

  it("caps an unconverted trial at the trial allowance", async () => {
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    await handleInboundMessage("org1", "919876543210", "hi");

    expect(ruleQueries[0].take).toBe(MAX_ACTIVE_RULES.trial);
    // The trial takes the tool-free path; it must still get the rules.
    expect(promptCalls[0].options.rules).toEqual(RULES);
  });

  it("an org with no rules gets the prompt it had before this feature", async () => {
    ruleRows.length = 0;
    await handleInboundMessage("org1", "919876543210", "hi");
    expect(promptCalls[0].options.rules).toEqual([]);
  });
});

describe("voice — buildCallInit", () => {
  const base = {
    org: { id: "org1", timezone: "Asia/Kolkata" },
    number: {
      phoneE164: "+918000000001",
      language: "en",
      voiceId: null,
      transferTo: null,
    },
    profile: {
      vertical: "clinic",
      businessName: "Gut Feeling",
      businessInfo: "",
      tone: "Warm",
      doNots: "",
    },
    knowledgeDigest: "- Consult ₹500",
    contact: { name: "Priya", phoneE164: "+919876543210" },
    source: "phone" as const,
    toolToken: "v1.1.sig",
    purpose: "inbound" as const,
    now: new Date("2026-09-22T04:30:00Z"),
  };

  it("carries the rules it is handed into the call's prompt", () => {
    const init = buildCallInit({ ...base, rules: RULES });

    expect(promptCalls[0].options.rules).toEqual(RULES);
    expect(init.conversation_config_override.agent.prompt.prompt).toContain(
      renderRulesBlock(RULES)
    );
  });
});

describe("inbox — suggested replies", () => {
  const grounding = {
    businessName: "Gut Feeling",
    businessInfo: "Legacy blob.",
    tone: "",
    doNots: "",
  };

  it("renders the rules above the business information", () => {
    const p = buildSuggestSystemPrompt(grounding, "professional", "", RULES);

    expect(p).toContain(renderRulesBlock(RULES));
    expect(p.indexOf("HOUSE RULES")).toBeLessThan(p.indexOf("BUSINESS INFORMATION"));
  });

  it("no longer claims the knowledge is the only source of truth", () => {
    for (const digest of ["", "HOURS\n- Open till 8pm"]) {
      const p = buildSuggestSystemPrompt(grounding, "professional", digest, RULES);
      expect(p).not.toContain("your only source of truth");
      expect(p).toContain("never invent details");
    }
  });

  it("loads the conversation's own org rules and puts them in the draft prompt", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      contact: { name: "Priya" },
      org: { name: "Gut Feeling" },
      messages: [
        { direction: "inbound", body: "do you do hair transplants?", createdAt: new Date() },
      ],
    });

    const result = await suggestReply("org1", "conv1", "professional");

    expect(result.ok).toBe(true);
    expect(ruleQueries[0].where).toEqual({ orgId: "org1", status: "active" });
    expect(chat.mock.calls[0][0].system).toContain(renderRulesBlock(RULES));
  });
});
