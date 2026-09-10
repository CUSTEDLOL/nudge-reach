import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, checkMessageLimit } = vi.hoisted(() => ({
  prisma: {
    campaign: { findFirst: vi.fn(), update: vi.fn() },
    message: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
  checkMessageLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/billing/limits", () => ({ checkMessageLimit }));
vi.mock("@/modules/messaging", () => ({ sendMessage: vi.fn() }));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook: vi.fn() }));

import { retryFailedMessages } from "@/modules/send/queue";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", status: "SENT" });
  prisma.message.findMany.mockResolvedValue([
    { id: "message-1", contactId: "contact-1", contact: { optedIn: true, optedOutAt: null } },
  ]);
  prisma.message.deleteMany.mockResolvedValue({ count: 1 });
  prisma.message.createMany.mockResolvedValue({ count: 1 });
  prisma.campaign.update.mockResolvedValue({});
  prisma.$transaction.mockResolvedValue([]);
  checkMessageLimit.mockResolvedValue({ allowed: true });
});

describe("retryFailedMessages plan enforcement", () => {
  it("checks the current plan limit before recreating failed queue rows", async () => {
    await retryFailedMessages("campaign-1", "org-1");
    expect(checkMessageLimit).toHaveBeenCalledWith("org-1", 1);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("does not mutate the queue when the current plan limit is exhausted", async () => {
    checkMessageLimit.mockResolvedValue({ allowed: false, message: "Monthly limit reached." });
    await expect(retryFailedMessages("campaign-1", "org-1")).rejects.toThrow("Monthly limit reached.");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
