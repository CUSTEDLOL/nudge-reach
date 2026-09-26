import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Human takeover. A teammate typing in the inbox and the AI replying on top of
 * them is the worst front-desk failure there is — the AI read the teammate's
 * "Hello, this is Vishesh" as its own words and greeted the customer as
 * Vishesh. So: a paused thread gets no AI reply, a human send pauses the
 * thread, and the switch is org-scoped.
 */

const {
  prisma,
  runAgent,
  chat,
  ensureAgentProfile,
  sendMessage,
  requireOrgContext,
  isRestrictedAcquisitionTrial,
  revalidatePath,
} = vi.hoisted(() => ({
  prisma: {
    contact: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    conversation: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    conversationMessage: { create: vi.fn(), findMany: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  runAgent: vi.fn(),
  chat: vi.fn(),
  ensureAgentProfile: vi.fn(),
  sendMessage: vi.fn(),
  requireOrgContext: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/model-router", () => ({ chat, runAgent, generate: vi.fn() }));
vi.mock("@/modules/messaging", () => ({ sendMessage }));
vi.mock("@/modules/agent/profile", () => ({ ensureAgentProfile }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
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

import { handleInboundMessage } from "@/modules/agent/inbound";
import { sendTextAction, setAiPausedAction } from "@/app/(app)/inbox/actions";

const ORG = "org_1";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isRestrictedAcquisitionTrial.mockResolvedValue(false);
  requireOrgContext.mockResolvedValue({ org: { id: ORG } });
  prisma.contact.findUnique.mockResolvedValue({ id: "c1" });
  prisma.contact.upsert.mockResolvedValue({
    id: "c1",
    name: "+6593964701",
    phoneE164: "+6593964701",
    optedIn: false,
    optedOutAt: null,
  });
  prisma.conversationMessage.create.mockResolvedValue({});
  ensureAgentProfile.mockResolvedValue({ enabled: true });
});

describe("a paused thread gets no AI reply", () => {
  it("records the customer's message but never calls the model or sends", async () => {
    prisma.conversation.upsert.mockResolvedValue({ id: "conv1", aiPaused: true });

    const result = await handleInboundMessage(ORG, "6593964701", "Hi");

    expect(result).toEqual({ conversationId: "conv1", skipped: "paused" });
    expect(prisma.conversationMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: "inbound", body: "Hi" }),
    });
    expect(runAgent).not.toHaveBeenCalled();
    expect(chat).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("human takeover from the inbox", () => {
  it("a teammate's reply pauses the AI on that thread", async () => {
    prisma.conversation.findFirst.mockResolvedValue({
      id: "conv1",
      contactId: "c1",
      status: "open",
      whatsappAccountId: null,
      lastInboundAt: new Date(),
      contact: { phoneE164: "+6593964701", optedIn: false, optedOutAt: null },
    });
    sendMessage.mockResolvedValue({ ok: true, providerMessageId: "wamid.1" });

    const result = await sendTextAction(
      form({ conversationId: "conv1", text: "Hello, this is Vishesh" })
    );

    expect(result.ok).toBe(true);
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: "conv1" },
      data: expect.objectContaining({ aiPaused: true }),
    });
  });

  it("the switch pauses and resumes, scoped to the caller's org", async () => {
    prisma.conversation.updateMany.mockResolvedValue({ count: 1 });

    const paused = await setAiPausedAction(form({ conversationId: "conv1", paused: "true" }));
    expect(paused.ok).toBe(true);
    expect(prisma.conversation.updateMany).toHaveBeenLastCalledWith({
      where: { id: "conv1", orgId: ORG },
      data: { aiPaused: true },
    });

    await setAiPausedAction(form({ conversationId: "conv1", paused: "false" }));
    expect(prisma.conversation.updateMany).toHaveBeenLastCalledWith({
      where: { id: "conv1", orgId: ORG },
      data: { aiPaused: false },
    });
  });

  it("another org's conversation is not found", async () => {
    prisma.conversation.updateMany.mockResolvedValue({ count: 0 });

    const result = await setAiPausedAction(form({ conversationId: "other", paused: "true" }));

    expect(result).toEqual({ ok: false, message: "Conversation not found." });
  });
});
