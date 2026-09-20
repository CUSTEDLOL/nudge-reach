import { describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { conversation: { findFirst } },
}));

import {
  getTrialReadOnlyConversation,
  getTrialTestConversation,
} from "@/modules/trial/test-inbox-query";
import { trialSandboxAddress } from "@/modules/trial/test-inbox";

describe("trial test history query", () => {
  it("hydrates only the org's deterministic sandbox conversation", async () => {
    findFirst.mockResolvedValue({
      messages: [{
        id: "message_1",
        direction: "inbound",
        body: "Are you open?",
        createdAt: new Date("2026-09-21T08:00:00Z"),
        metaMessageId: null,
      }],
    });

    await expect(getTrialTestConversation("org_1")).resolves.toEqual({
      conversationId: null,
      messages: [
        expect.objectContaining({
          id: "message_1",
          createdAt: "2026-09-21T08:00:00.000Z",
        }),
      ],
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        orgId: "org_1",
        contact: { phoneE164: trialSandboxAddress("org_1") },
      },
      select: expect.objectContaining({ messages: expect.any(Object) }),
    });
  });

  it("opens only the requested conversation for the org's sandbox identity", async () => {
    findFirst.mockResolvedValue({
      id: "conversation_1",
      status: "open",
      lastInboundAt: new Date("2026-09-21T08:00:00Z"),
      messages: [],
    });

    await expect(
      getTrialReadOnlyConversation("org_1", "conversation_1"),
    ).resolves.toEqual({
      id: "conversation_1",
      status: "open",
      lastInboundAt: "2026-09-21T08:00:00.000Z",
      messages: [],
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: "conversation_1",
        orgId: "org_1",
        contact: { phoneE164: trialSandboxAddress("org_1") },
      },
      select: expect.objectContaining({
        id: true,
        status: true,
        messages: expect.any(Object),
      }),
    });
  });
});
