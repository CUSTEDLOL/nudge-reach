import { describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { conversation: { findFirst } },
}));

import { getTrialTestMessages } from "@/modules/trial/test-inbox-query";
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

    await expect(getTrialTestMessages("org_1")).resolves.toEqual([
      expect.objectContaining({
        id: "message_1",
        createdAt: "2026-09-21T08:00:00.000Z",
      }),
    ]);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        orgId: "org_1",
        contact: { phoneE164: trialSandboxAddress("org_1") },
      },
      select: expect.objectContaining({ messages: expect.any(Object) }),
    });
  });
});
