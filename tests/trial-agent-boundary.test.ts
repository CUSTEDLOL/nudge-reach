import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  isRestrictedAcquisitionTrial,
  generateAgentReply,
  generateAgentActionReply,
  sendMessage,
  crmContactCreated,
  scoreContactSoon,
  runInboundAutomations,
  dispatchWebhook,
} = vi.hoisted(() => ({
  prisma: {
    contact: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    conversation: { upsert: vi.fn(), update: vi.fn() },
    conversationMessage: { create: vi.fn(), findMany: vi.fn() },
    org: { findUnique: vi.fn() },
    knowledgeEntry: { findMany: vi.fn() },
  },
  isRestrictedAcquisitionTrial: vi.fn(),
  generateAgentReply: vi.fn(),
  generateAgentActionReply: vi.fn(),
  sendMessage: vi.fn(),
  crmContactCreated: vi.fn(),
  scoreContactSoon: vi.fn(),
  runInboundAutomations: vi.fn(),
  dispatchWebhook: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/trial/capabilities", () => ({ isRestrictedAcquisitionTrial }));
vi.mock("@/modules/agent/reply", () => ({
  buildHistory: (messages: { direction: string; body: string }[]) =>
    messages.map((message) => ({
      role: message.direction === "inbound" ? "user" : "assistant",
      text: message.body,
    })),
  generateAgentReply,
  generateAgentActionReply,
}));
vi.mock("@/modules/messaging", () => ({ sendMessage }));
vi.mock("@/modules/crm/events", () => ({ crmContactCreated }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/scoring/compute", () => ({ scoreContactSoon }));
vi.mock("@/modules/automation/engine", () => ({ runInboundAutomations }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook }));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn().mockResolvedValue({
    enabled: true,
    vertical: "clinic",
    businessName: "Aster Clinic",
    businessInfo: "Open Monday to Saturday.",
    tone: "warm",
    doNots: "",
  }),
}));

import { handleInboundMessage } from "@/modules/agent/inbound";

describe("restricted trial agent boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
    prisma.contact.findUnique.mockResolvedValue(null);
    prisma.contact.upsert.mockResolvedValue({
      id: "contact_1",
      name: "Test customer",
      phoneE164: "+999123",
      optedIn: false,
      optedOutAt: null,
    });
    prisma.conversation.upsert.mockResolvedValue({
      id: "conversation_1",
      whatsappAccountId: null,
    });
    prisma.conversationMessage.create.mockResolvedValue({});
    prisma.conversationMessage.findMany.mockResolvedValue([
      { direction: "inbound", body: "Can I book tomorrow?" },
    ]);
    prisma.conversation.update.mockResolvedValue({});
    prisma.org.findUnique.mockResolvedValue({ timezone: "Asia/Kolkata" });
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    generateAgentReply.mockResolvedValue({
      text: "We can help with that.",
      handoff: false,
      generatedByAi: true,
    });
    sendMessage.mockResolvedValue({ ok: true, providerMessageId: "sim_1" });
  });

  it("answers without write tools, automations, CRM sync, scoring, or webhooks", async () => {
    const result = await handleInboundMessage(
      "org_1",
      "+999123",
      "Can I book tomorrow?",
    );

    expect(result).toMatchObject({
      reply: "We can help with that.",
      generatedByAi: true,
    });
    expect(generateAgentReply).toHaveBeenCalledTimes(1);
    expect(generateAgentActionReply).not.toHaveBeenCalled();
    expect(runInboundAutomations).not.toHaveBeenCalled();
    expect(crmContactCreated).not.toHaveBeenCalled();
    expect(scoreContactSoon).not.toHaveBeenCalled();
    expect(dispatchWebhook).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      "whatsapp",
      expect.objectContaining({ address: "+999123" }),
      expect.any(Object),
      expect.objectContaining({ suppressWebhook: true }),
    );
  });

  it("does not persist a trial handoff as paid inbox state", async () => {
    generateAgentReply.mockResolvedValue({
      text: "A person can help with that.",
      handoff: true,
    });

    await handleInboundMessage("org_1", "+999123", "I need a person");

    expect(prisma.conversation.update).not.toHaveBeenCalledWith({
      where: { id: "conversation_1" },
      data: { status: "handoff" },
    });
  });
});
