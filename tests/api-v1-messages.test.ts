import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E1 POST /api/v1/messages — the invariants under test:
 *  - free-form outside the 24h window → 422, nothing sent (invariant 6)
 *  - unapproved template → 422, nothing sent
 *  - consent-blocked MARKETING template → 403 (invariant 2, via sendMessage)
 *  - happy free-form path sends and persists
 */

const { prisma, sendMessage } = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    contact: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    conversation: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    conversationMessage: { create: vi.fn() },
    template: { findFirst: vi.fn() },
    $transaction: vi.fn().mockResolvedValue([]),
  },
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/messaging", () => ({ sendMessage }));
vi.mock("@/modules/integrations/api-auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveApiKeyOrg: vi.fn().mockResolvedValue({
    ok: true,
    org: { id: "org1", plan: "growth", dialCode: "+91" },
    apiKeyId: "k1",
  }),
}));

import { POST } from "@/app/api/v1/messages/route";

const CONTACT = {
  id: "c1",
  orgId: "org1",
  name: "Priya Shah",
  phoneE164: "+919876543210",
  optedIn: true,
  optedOutAt: null,
};

const post = (body: object) =>
  POST(
    new Request("https://x/api/v1/messages", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { authorization: "Bearer nk_live_test" },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockResolvedValue([]);
  prisma.contact.findFirst.mockResolvedValue(CONTACT);
});

describe("POST /api/v1/messages — free-form", () => {
  it("422s outside the 24h window and sends nothing", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "cv1",
      lastInboundAt: new Date(Date.now() - 25 * 3600_000),
    });
    const res = await post({ contact_id: "c1", text: "hi" });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("24-hour");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("422s when the contact has no conversation at all", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    const res = await post({ contact_id: "c1", text: "hi" });
    expect(res.status).toBe(422);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends and persists inside the window", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: "cv1",
      lastInboundAt: new Date(Date.now() - 3600_000),
    });
    sendMessage.mockResolvedValue({ ok: true, providerMessageId: "sim-123" });
    const res = await post({ contact_id: "c1", text: "hi" });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { provider_message_id: string } };
    expect(json.data.provider_message_id).toBe("sim-123");
    expect(sendMessage).toHaveBeenCalledWith(
      "whatsapp",
      expect.objectContaining({ address: CONTACT.phoneE164 }),
      { kind: "text", text: "hi" },
      { orgId: "org1" }
    );
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe("POST /api/v1/messages — template", () => {
  it("422s an unapproved template", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.template.findFirst.mockResolvedValue(null); // filter requires APPROVED
    const res = await post({ contact_id: "c1", template_id: "t1" });
    expect(res.status).toBe(422);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("403s when the consent gate blocks a MARKETING template", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.template.findFirst.mockResolvedValue({
      id: "t1", name: "promo", language: "en", category: "MARKETING", content: {},
    });
    sendMessage.mockResolvedValue({ ok: false, blockedByConsent: true });
    const res = await post({ contact_id: "c1", template_id: "t1" });
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
