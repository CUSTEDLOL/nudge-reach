import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const calls: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  return {
    calls,
    messages,
    prisma: {
      voiceCall: {
        findUnique: vi.fn(async ({ where }: { where: { providerCallId: string } }) =>
          calls.find((c) => c.providerCallId === where.providerCallId) ?? null
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: "vc1", ...data };
          calls.push(row);
          return row;
        }),
      },
      contact: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async () => ({ id: "c1", name: "+919876543210", optedIn: false, optedOutAt: null })),
      },
      conversation: { upsert: vi.fn(async () => ({ id: "cv1" })), update: vi.fn(async () => ({})) },
      conversationMessage: {
        createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => {
          messages.push(...data);
          return { count: data.length };
        }),
      },
    },
  };
});
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn(async () => {}) }));
vi.mock("@/modules/crm/events", () => ({ crmContactCreated: vi.fn(async () => {}) }));

import { fileCall } from "@/modules/voice/file-call";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";

const call = {
  providerCallId: "conv_1",
  agentId: "a",
  direction: "inbound" as const,
  fromE164: "+919876543210",
  toE164: "+918000000001",
  durationSecs: 30,
  transcript: [
    { role: "agent" as const, message: "Hello", t: 0, toolCalls: [] },
    { role: "user" as const, message: "Book tomorrow 5", t: 3, toolCalls: [] },
    { role: "agent" as const, message: "Done", t: 8, toolCalls: ["capture_booking_request"] },
  ],
  summary: "Booked.",
  callSuccessful: true,
  dynamicVariables: { org_id: "org1" },
};

beforeEach(() => {
  db.calls.length = 0;
  db.messages.length = 0;
  vi.clearAllMocks();
});

describe("fileCall", () => {
  it("creates contact, voice conversation, one message per turn and a VoiceCall", async () => {
    const r = await fileCall("org1", call, "inbound");
    expect(r).toEqual({ voiceCallId: "vc1", conversationId: "cv1", contactId: "c1" });
    expect(db.prisma.conversation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ channel: "voice", orgId: "org1", contactId: "c1" }),
      })
    );
    expect(db.messages.map((m) => m.direction)).toEqual(["outbound", "inbound", "outbound"]);
    expect(db.calls[0]).toMatchObject({ outcome: "booked", durationSecs: 30, purpose: "inbound", status: "completed" });
    expect(dispatchWebhook).toHaveBeenCalledWith("org1", "call.completed", expect.objectContaining({ outcome: "booked" }));
  });

  it("is idempotent on providerCallId", async () => {
    await fileCall("org1", call, "inbound");
    await fileCall("org1", call, "inbound");
    expect(db.prisma.voiceCall.create).toHaveBeenCalledTimes(1);
  });
});
