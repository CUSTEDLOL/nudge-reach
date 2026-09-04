import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E8 chat summaries:
 *  - keyless mode returns a labeled sample, still notes + meters (invariant 4)
 *  - with a key, the router's chat() output becomes a note + CRM sync
 *  - empty threads refuse politely
 */

const { prisma, chat, recordSyntheticUsage, crmConversationSummary, envState } = vi.hoisted(() => ({
  envState: { ANTHROPIC_API_KEY: "" as string | undefined },
  prisma: {
    conversation: { findFirst: vi.fn() },
    note: { create: vi.fn().mockResolvedValue({}) },
  },
  chat: vi.fn(),
  recordSyntheticUsage: vi.fn(),
  crmConversationSummary: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/model-router", () => ({ chat }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage }));
vi.mock("@/modules/crm/events", () => ({ crmConversationSummary }));

vi.mock("@/lib/env", () => ({ env: envState }));

import { summarizeConversation } from "@/modules/ai/summarize";

const CONVO = {
  contactId: "c1",
  contact: { name: "Priya Shah", phoneE164: "+919876543210" },
  messages: [
    { direction: "outbound", body: "See you Friday at 7!", createdAt: new Date() },
    { direction: "inbound", body: "Book me Friday 7pm, party of 4", createdAt: new Date() },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  envState.ANTHROPIC_API_KEY = "";
  prisma.conversation.findFirst.mockResolvedValue(CONVO);
});

describe("summarizeConversation — keyless (invariant 4)", () => {
  it("returns a labeled sample, saves the note, meters synthetically", async () => {
    const r = await summarizeConversation("org1", "cv1");
    expect(r.ok).toBe(true);
    expect(r.sample).toBe(true);
    expect(r.summary).toContain("Sample summary");
    const note = prisma.note.create.mock.calls[0][0].data;
    expect(note.orgId).toBe("org1");
    expect(note.authorName).toBe("AI Assistant");
    expect(note.body).toContain("Chat summary:");
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "org1", conversationId: "cv1", purpose: "summary" },
      expect.any(String),
      expect.any(String)
    );
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("summarizeConversation — with a key", () => {
  it("summarizes via the router, notes it and fires the CRM sync", async () => {
    envState.ANTHROPIC_API_KEY = "sk-test";
    chat.mockResolvedValue("Customer wants Friday 7pm, party of 4. Booking confirmed.");
    const r = await summarizeConversation("org1", "cv1");
    expect(r.ok).toBe(true);
    expect(r.sample).toBeFalsy();
    // Transcript reached the model with roles labeled, attributed as summary.
    const call = chat.mock.calls[0][0];
    expect(call.messages[0].text).toContain("Customer: Book me Friday 7pm");
    expect(call.attribution).toEqual({ orgId: "org1", conversationId: "cv1", purpose: "summary" });
    expect(prisma.note.create).toHaveBeenCalledOnce();
    expect(crmConversationSummary).toHaveBeenCalledWith(
      "org1",
      "cv1",
      { phoneE164: "+919876543210" },
      expect.stringContaining("Friday 7pm")
    );
  });

  it("refuses an empty thread", async () => {
    prisma.conversation.findFirst.mockResolvedValue({ ...CONVO, messages: [] });
    const r = await summarizeConversation("org1", "cv1");
    expect(r.ok).toBe(false);
    expect(prisma.note.create).not.toHaveBeenCalled();
  });
});
