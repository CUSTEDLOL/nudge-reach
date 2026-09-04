import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E4 sticky routing: the conversation remembers which number the customer
 * wrote to, and outbound resolution uses that number's credentials.
 */

const { prisma, getWhatsappCredentials } = vi.hoisted(() => ({
  prisma: {
    contact: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: "c1" }) },
    conversation: { upsert: vi.fn() },
    conversationMessage: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn() },
    org: { findUnique: vi.fn() },
    knowledgeEntry: { findMany: vi.fn().mockResolvedValue([]) },
    webhookEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
  },
  getWhatsappCredentials: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { SEND_MODE: "live", WHATSAPP_API_VERSION: "v23.0" },
}));
vi.mock("@/modules/crm/events", () => ({ crmContactCreated: vi.fn() }));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/automation/engine", () => ({
  runInboundAutomations: vi.fn().mockResolvedValue({ replied: false }),
}));
vi.mock("@/modules/agent/profile", () => ({
  ensureAgentProfile: vi.fn().mockResolvedValue(null), // stop before the model
}));
vi.mock("@/modules/orgs/mode", () => ({
  orgSendMode: vi.fn().mockResolvedValue("live"),
  sendModeFor: vi.fn().mockReturnValue("live"),
  isSimulated: vi.fn().mockReturnValue(false),
}));
vi.mock("@/modules/whatsapp/accounts", () => ({ getWhatsappCredentials }));

import { handleInboundMessage } from "@/modules/agent/inbound";
import { sendMessage } from "@/modules/messaging";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.contact.upsert.mockResolvedValue({
    id: "c1",
    optedIn: true,
    optedOutAt: null,
    name: "Priya",
  });
  prisma.conversation.upsert.mockResolvedValue({ id: "cv1", whatsappAccountId: "wa2" });
});

describe("inbound stamps the receiving number (sticky)", () => {
  it("conversation upsert writes whatsappAccountId on create AND update", async () => {
    await handleInboundMessage("org1", "+919876543210", "hi", {
      whatsappAccountId: "wa2",
    });
    const args = prisma.conversation.upsert.mock.calls[0][0];
    expect(args.create.whatsappAccountId).toBe("wa2");
    expect(args.update.whatsappAccountId).toBe("wa2");
  });

  it("the simulator (no account) leaves the stored number untouched", async () => {
    await handleInboundMessage("org1", "+919876543210", "hi");
    const args = prisma.conversation.upsert.mock.calls[0][0];
    expect(args.create.whatsappAccountId).toBeUndefined();
    expect(args.update.whatsappAccountId).toBeUndefined();
  });
});

describe("outbound resolves the conversation's number", () => {
  it("sendMessage passes whatsappAccountId into credential resolution", async () => {
    getWhatsappCredentials.mockResolvedValue({
      wabaId: "waba",
      phoneNumberId: "pn-200",
      accessToken: "tok",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 })
      );

    await sendMessage(
      "whatsapp",
      { address: "+919876543210", optedIn: true, optedOutAt: null },
      { kind: "text", text: "hello" },
      { orgId: "org1", whatsappAccountId: "wa2" }
    );
    expect(getWhatsappCredentials).toHaveBeenCalledWith("org1", "wa2");
    // The Cloud API call targets the resolved number's phoneNumberId.
    expect(String(fetchSpy.mock.calls[0][0])).toContain("pn-200");
  });
});
