import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    systemHeartbeat: { findUnique: vi.fn() },
    webhookDelivery: { findMany: vi.fn() },
    template: { findMany: vi.fn() },
    automationRun: { findFirst: vi.fn() },
    conversationMessage: { findFirst: vi.fn() },
    aiUsage: { findFirst: vi.fn(), groupBy: vi.fn() },
    message: { groupBy: vi.fn() },
    campaign: { findMany: vi.fn() },
    crmSyncJob: { findMany: vi.fn() },
    org: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { deriveOpsSeverity } from "@/modules/admin/health";
import { buildCostAlerts, opsOverview } from "@/modules/admin/ops";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.systemHeartbeat.findUnique.mockResolvedValue({
    status: "ok",
    detail: {},
    lastSeenAt: new Date("2026-09-09T09:58:00Z"),
  });
  prisma.webhookDelivery.findMany.mockResolvedValue([]);
  prisma.template.findMany.mockResolvedValue([]);
  prisma.automationRun.findFirst.mockResolvedValue(null);
  prisma.conversationMessage.findFirst.mockResolvedValue(null);
  prisma.aiUsage.findFirst.mockResolvedValue(null);
  prisma.aiUsage.groupBy.mockResolvedValue([]);
  prisma.message.groupBy.mockResolvedValue([]);
  prisma.campaign.findMany.mockResolvedValue([]);
  prisma.crmSyncJob.findMany.mockResolvedValue([]);
  prisma.org.findMany.mockResolvedValue([]);
});

describe("buildCostAlerts", () => {
  it("keeps only orgs over the threshold, sorted worst-first", () => {
    const alerts = buildCostAlerts([
      // growth INR ≈ ₹2,499? — whatever the real price, $40 of AI cost on any
      // sub-$100 plan is over 35%; $0.10 on the same plan is not.
      { orgId: "a", orgName: "Hot", plan: "growth", currency: "INR", costMicroUsd30d: 40_000_000 },
      { orgId: "b", orgName: "Cold", plan: "growth", currency: "INR", costMicroUsd30d: 100_000 },
    ]);
    expect(alerts.map((a) => a.orgId)).toEqual(["a"]);
    expect(alerts[0].pctOfPlan).toBeGreaterThan(35);
  });

  it("never alerts on unpriced (free/unknown) plans and survives junk currency", () => {
    const alerts = buildCostAlerts([
      { orgId: "c", orgName: "Free", plan: "free", currency: "INR", costMicroUsd30d: 99_000_000 },
      { orgId: "d", orgName: "Junk", plan: "growth", currency: "XXX", costMicroUsd30d: 40_000_000 },
    ]);
    expect(alerts.find((a) => a.orgId === "c")).toBeUndefined();
    // Junk currency falls back to INR pricing rather than crashing.
    expect(alerts.find((a) => a.orgId === "d")).toBeDefined();
  });
});

describe("ops severity", () => {
  const clear = {
    heartbeat: "healthy" as const,
    staleQueued: 0,
    failedMessages: 0,
    deadCrmJobs: 0,
    webhookFailures: 0,
    stuckTemplates: 0,
    costAlerts: 0,
  };

  it("treats an old queue as degraded and failed/dead work as critical", () => {
    expect(deriveOpsSeverity({ ...clear, staleQueued: 1 })).toBe("degraded");
    expect(deriveOpsSeverity({ ...clear, failedMessages: 1 })).toBe("critical");
    expect(deriveOpsSeverity({ ...clear, deadCrmJobs: 1 })).toBe("critical");
  });

  it("reads only old queued work and returns grouped incidents without sensitive fields", async () => {
    const now = new Date("2026-09-09T10:00:00Z");
    prisma.message.groupBy.mockImplementation(async ({ where }: { where: { status: string } }) =>
      where.status === "QUEUED"
        ? [{ campaignId: "campaign-1", _count: 3, _min: { createdAt: new Date("2026-09-09T09:40:00Z") } }]
        : [{ campaignId: "campaign-1", _count: 2, _max: { updatedAt: new Date("2026-09-09T09:50:00Z") } }]
    );
    prisma.campaign.findMany.mockResolvedValue([
      { id: "campaign-1", name: "Re-engage", status: "SENT", org: { id: "org-1", name: "Glow", suspendedAt: null } },
    ]);
    prisma.crmSyncJob.findMany.mockResolvedValue([
      { id: "job-1", orgId: "org-1", provider: "zoho", event: "contact.created", attempts: 5, updatedAt: new Date("2026-09-09T09:30:00Z"), org: { id: "org-1", name: "Glow" } },
    ]);

    const result = await opsOverview(now);
    expect(result.queuedCampaigns[0]).toMatchObject({ campaignId: "campaign-1", count: 3 });
    expect(result.failedCampaigns[0]).toMatchObject({ campaignId: "campaign-1", count: 2, retryEligible: true });
    expect(result.deadCrmJobs[0]).toMatchObject({ id: "job-1", event: "contact.created" });
    expect(result.severity).toBe("critical");

    const queuedArgs = prisma.message.groupBy.mock.calls.find(
      ([args]) => args.where.status === "QUEUED"
    )![0];
    expect(queuedArgs.where.createdAt.lt).toEqual(new Date("2026-09-09T09:45:00Z"));
    const allCalls = JSON.stringify({
      message: prisma.message.groupBy.mock.calls,
      crm: prisma.crmSyncJob.findMany.mock.calls,
      campaign: prisma.campaign.findMany.mock.calls,
    });
    expect(allCalls).not.toContain("payload");
    expect(allCalls).not.toContain("contactId");
    expect(allCalls).not.toContain("body");
    expect(allCalls).not.toContain("secret");
    expect(allCalls).not.toContain("credentials");
  });
});
