import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Zero-balance behaviour at the call sites (Task 5 of
 * docs/superpowers/plans/2026-09-15-credit-ledger.md). The doorway throws
 * CreditsExhaustedError before the provider is called; each customer-facing
 * caller turns that into the right outcome — the agent hands off (no customer
 * is left unanswered), drafts / summaries / campaign copy show the credits
 * message. Voice and concierge ingest are never gated.
 */

const { prisma, envState, chat, runAgent, generate, sendMessage, ensureAgentProfile, requireOrg } =
  vi.hoisted(() => ({
    envState: {
      ANTHROPIC_API_KEY: "sk-test",
      SEND_MODE: "live",
      TOKEN_ENCRYPTION_KEY: "k".repeat(32),
      WHATSAPP_API_VERSION: "v23.0",
    },
    prisma: {
      org: { findUnique: vi.fn() },
      llmAccount: { findUnique: vi.fn() },
      creditGrant: { aggregate: vi.fn(), create: vi.fn() },
      contact: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
      conversation: { upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
      conversationMessage: { create: vi.fn(), findMany: vi.fn() },
      knowledgeEntry: { findMany: vi.fn() },
      agentProfile: { findUnique: vi.fn() },
      note: { create: vi.fn() },
    },
    chat: vi.fn(),
    runAgent: vi.fn(),
    generate: vi.fn(),
    sendMessage: vi.fn(),
    ensureAgentProfile: vi.fn(),
    requireOrg: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ chat, runAgent, generate }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage }));
vi.mock("@/modules/agent/profile", () => ({ ensureAgentProfile }));
vi.mock("@/modules/agent/tools/custom", () => ({
  loadCustomTools: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/modules/crm/events", () => ({
  crmContactCreated: vi.fn(),
  crmBookingCreated: vi.fn(),
  crmPaymentPaid: vi.fn(),
  crmHandoffRequested: vi.fn(),
  crmConversationSummary: vi.fn(),
}));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/scoring/compute", () => ({ scoreContactSoon: vi.fn() }));
vi.mock("@/modules/automation/engine", () => ({
  runInboundAutomations: vi.fn().mockResolvedValue({ replied: false }),
  cancelWaitingRuns: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrg,
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { encryptSecret } from "@/lib/crypto";
import { wizardFromPhotoAction } from "@/app/(app)/campaigns/actions";
import { handleInboundMessage } from "@/modules/agent/inbound";
import { generateAgentActionReply } from "@/modules/agent/reply";
import { suggestReply } from "@/modules/ai/suggest-reply";
import { summarizeConversation } from "@/modules/ai/summarize";
import {
  CREDITS_EXHAUSTED_MESSAGE,
  CreditsExhaustedError,
  creditsExhausted,
} from "@/modules/billing/credits";
import { generateCampaignContent } from "@/modules/campaign/generate";

const FUTURE = new Date(Date.now() + 30 * 86_400_000);
const starter = {
  id: "org1",
  plan: "starter",
  featureOverrides: {},
  includedCreditsOverride: null,
  trialEndsAt: null,
  subscriptionStatus: "active",
  currentPeriodEnd: FUTURE,
};
const profile = {
  vertical: "clinic",
  businessName: "Glow Clinic",
  businessInfo: "Open Mon–Sat.",
  tone: "Warm",
  doNots: "",
};
const toolCtx = {
  orgId: "org1",
  contactId: "c1",
  conversationId: "cv1",
  contactName: "Priya",
  contactPhone: "+919876543210",
};
const exhausted = () => new CreditsExhaustedError("org1");
const balance = (micro: number) => ({ _sum: { remainingMicroUsd: micro } });

beforeEach(() => {
  vi.clearAllMocks();
  envState.SEND_MODE = "live";
  envState.ANTHROPIC_API_KEY = "sk-test";
  prisma.org.findUnique.mockResolvedValue(starter);
  prisma.llmAccount.findUnique.mockResolvedValue(null);
  prisma.creditGrant.aggregate.mockResolvedValue(balance(500_000));
  prisma.creditGrant.create.mockResolvedValue({});
  prisma.knowledgeEntry.findMany.mockResolvedValue([]);
  prisma.agentProfile.findUnique.mockResolvedValue(null);
  prisma.note.create.mockResolvedValue({});
});

describe("agent reply", () => {
  it("generateAgentActionReply returns the handoff line with pausedForCredits on exhaustion (no throw)", async () => {
    runAgent.mockRejectedValue(exhausted());
    const r = await generateAgentActionReply(profile, [{ role: "user", text: "hi" }], toolCtx);
    expect(r).toEqual({
      text: expect.stringContaining("One of our team will get back to you"),
      handoff: true,
      actions: [],
      pausedForCredits: true,
    });
  });

  it("any other error still propagates", async () => {
    runAgent.mockRejectedValue(new Error("provider down"));
    await expect(
      generateAgentActionReply(profile, [{ role: "user", text: "hi" }], toolCtx)
    ).rejects.toThrow("provider down");
  });

  it("inbound path still answers the customer with the handoff line and flags the conversation", async () => {
    runAgent.mockRejectedValue(exhausted());
    ensureAgentProfile.mockResolvedValue({ ...profile, enabled: true });
    prisma.contact.findUnique.mockResolvedValue({ id: "c1" });
    prisma.contact.upsert.mockResolvedValue({
      id: "c1",
      name: "Priya",
      optedIn: true,
      optedOutAt: null,
    });
    prisma.conversation.upsert.mockResolvedValue({ id: "cv1", whatsappAccountId: null });
    prisma.conversation.update.mockResolvedValue({});
    prisma.conversationMessage.create.mockResolvedValue({});
    prisma.conversationMessage.findMany.mockResolvedValue([
      { direction: "inbound", body: "hi", createdAt: new Date() },
    ]);
    prisma.org.findUnique.mockResolvedValue({ timezone: "Asia/Kolkata" });
    sendMessage.mockResolvedValue({ providerMessageId: "wamid.1" });

    const r = await handleInboundMessage("org1", "919876543210", "hi");

    expect(r.handoff).toBe(true);
    expect(r.reply).toContain("One of our team will get back to you");
    expect(sendMessage).toHaveBeenCalledWith(
      "whatsapp",
      expect.objectContaining({ address: "+919876543210" }),
      { kind: "text", text: r.reply },
      expect.objectContaining({ orgId: "org1" })
    );
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: "outbound", body: r.reply }),
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "cv1" },
      data: { status: "handoff" },
    });
  });
});

describe("suggestReply and summarizeConversation return CREDITS_EXHAUSTED_MESSAGE", () => {
  it("suggestReply", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      contact: { name: "Priya Shah" },
      org: { name: "Glow Clinic" },
      messages: [{ direction: "inbound", body: "Price for PRP?", createdAt: new Date() }],
    });
    chat.mockRejectedValue(exhausted());
    await expect(suggestReply("org1", "cv1", "friendly")).resolves.toEqual({
      ok: false,
      error: CREDITS_EXHAUSTED_MESSAGE,
    });
  });

  it("summarizeConversation (and writes no note)", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      contactId: "c1",
      contact: { name: "Priya Shah", phoneE164: "+919876543210" },
      messages: [{ direction: "inbound", body: "Price for PRP?", createdAt: new Date() }],
    });
    chat.mockRejectedValue(exhausted());
    await expect(summarizeConversation("org1", "cv1")).resolves.toEqual({
      ok: false,
      error: CREDITS_EXHAUSTED_MESSAGE,
    });
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it("summarizeConversation lets any other error propagate", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      contactId: "c1",
      contact: { name: "Priya Shah", phoneE164: "+919876543210" },
      messages: [{ direction: "inbound", body: "hi", createdAt: new Date() }],
    });
    chat.mockRejectedValue(new Error("provider down"));
    await expect(summarizeConversation("org1", "cv1")).rejects.toThrow("provider down");
  });
});

describe("campaign copy generation surfaces CREDITS_EXHAUSTED_MESSAGE", () => {
  it("generateCampaignContent rethrows the credits message", async () => {
    generate.mockRejectedValue(exhausted());
    await expect(
      generateCampaignContent({ description: "Silk sarees from ₹2,499", orgId: "org1" })
    ).rejects.toThrow(CREDITS_EXHAUSTED_MESSAGE);
  });

  it("the wizard action returns it as the user-facing message", async () => {
    generate.mockRejectedValue(exhausted());
    requireOrg.mockResolvedValue({ id: "org1" });
    prisma.org.findUnique.mockResolvedValue({ dialCode: "+91" });
    const fd = new FormData();
    fd.set("description", "Silk sarees from ₹2,499");
    await expect(wizardFromPhotoAction(fd)).resolves.toEqual({
      ok: false,
      message: CREDITS_EXHAUSTED_MESSAGE,
    });
  });
});

describe("creditsExhausted is true only for a metered org at zero", () => {
  it("metered org at zero → true", async () => {
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(creditsExhausted("org1")).resolves.toBe(true);
  });

  it("metered org with a balance → false", async () => {
    await expect(creditsExhausted("org1")).resolves.toBe(false);
  });

  it("simulation → false without touching the ledger", async () => {
    envState.SEND_MODE = "simulation";
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(creditsExhausted("org1")).resolves.toBe(false);
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
  });

  it("legacy unmetered plan → false", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "front_desk" });
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(creditsExhausted("org1")).resolves.toBe(false);
  });

  it("BYOK org → false even at zero", async () => {
    prisma.org.findUnique.mockResolvedValue({ ...starter, plan: "enterprise" });
    prisma.llmAccount.findUnique.mockResolvedValue({
      orgId: "org1",
      provider: "anthropic",
      model: "claude-haiku-4-5",
      apiKeyEncrypted: encryptSecret("sk-customer"),
    });
    prisma.creditGrant.aggregate.mockResolvedValue(balance(0));
    await expect(creditsExhausted("org1")).resolves.toBe(false);
  });

  it("unknown org → false, never throws", async () => {
    prisma.org.findUnique.mockResolvedValue(null);
    await expect(creditsExhausted("nope")).resolves.toBe(false);
  });

  it("a ledger read failure → false, never throws", async () => {
    prisma.creditGrant.aggregate.mockRejectedValue(new Error("db down"));
    await expect(creditsExhausted("org1")).resolves.toBe(false);
  });
});

describe("never gated at the call site", () => {
  it("voice initiation does not import from billing/credits", () => {
    const files = [
      "src/app/api/voice/initiation/route.ts",
      "src/modules/voice/initiation.ts",
      "src/modules/voice/usage.ts",
      "src/modules/knowledge/ingest.ts",
      "src/modules/knowledge/distill.ts",
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toMatch(/billing\/credits/);
    }
  });
});
