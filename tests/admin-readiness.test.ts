import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    agentProfile: { findUnique: vi.fn() },
    calendarAccount: { findUnique: vi.fn() },
    template: { count: vi.fn() },
    followUpConfig: { findUnique: vi.fn() },
    knowledgeEntry: { count: vi.fn() },
    agentRule: { count: vi.fn() },
    whatsappAccount: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));

import { getConciergeStatus } from "@/modules/concierge";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.agentProfile.findUnique.mockResolvedValue({
    enabled: true,
    businessInfo: "Clinic hours and services",
  });
  prisma.calendarAccount.findUnique.mockResolvedValue({ id: "calendar_1" });
  prisma.template.count.mockResolvedValue(2);
  prisma.followUpConfig.findUnique.mockResolvedValue({ enabled: true });
  prisma.knowledgeEntry.count.mockResolvedValue(1);
  prisma.agentRule.count.mockResolvedValue(0);
  prisma.whatsappAccount.count.mockResolvedValue(1);
});

describe("founder go-live readiness", () => {
  it("is blocked without a usable WhatsApp account", async () => {
    prisma.whatsappAccount.count.mockResolvedValue(0);

    const status = await getConciergeStatus("org_1");

    expect(status.whatsappConnected).toBe(false);
    expect(status.ready).toBe(false);
    expect(prisma.whatsappAccount.count).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: "connected" },
    });
  });

  it("is ready only when every required dependency is usable", async () => {
    const status = await getConciergeStatus("org_1");

    expect(status).toMatchObject({
      whatsappConnected: true,
      agentConfigured: true,
      agentEnabled: true,
      calendarConnected: true,
      approvedTemplates: 2,
      followUpEnabled: true,
      ready: true,
    });
  });

  /**
   * `agentConfigured` used to be `businessInfo.trim() || knowledgeCount`, and
   * no prompt builder has read `businessInfo` since fe85add — so a client whose
   * whole knowledge base sat in that column got a green "Knowledge base + agent
   * persona" tick for an agent whose prompt said "(No details provided yet.)".
   * Only rows a prompt carries count now.
   */
  it("is not configured by the retired Setup blob alone", async () => {
    prisma.knowledgeEntry.count.mockResolvedValue(0);
    prisma.agentRule.count.mockResolvedValue(0);

    const status = await getConciergeStatus("org_1");

    expect(status.agentConfigured).toBe(false);
    expect(status.ready).toBe(false);
  });

  it("counts active house rules as grounding, and ignores drafts", async () => {
    prisma.knowledgeEntry.count.mockResolvedValue(0);
    prisma.agentRule.count.mockResolvedValue(3);

    const status = await getConciergeStatus("org_1");

    expect(status.agentConfigured).toBe(true);
    // A draft fact reaches no prompt until a human approves it, so neither
    // count may include one.
    expect(prisma.knowledgeEntry.count).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: "active" },
    });
    expect(prisma.agentRule.count).toHaveBeenCalledWith({
      where: { orgId: "org_1", status: "active" },
    });
  });
});
