import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, retryFailedMessages, refreshLibraryTemplateStatus } = vi.hoisted(() => ({
  prisma: {
    campaign: { findFirst: vi.fn() },
    crmSyncJob: { findFirst: vi.fn(), updateMany: vi.fn() },
    template: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  retryFailedMessages: vi.fn(),
  refreshLibraryTemplateStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/send/queue", () => ({ retryFailedMessages }));
vi.mock("@/modules/whatsapp/library", () => ({ refreshLibraryTemplateStatus }));

import {
  founderRefreshTemplate,
  founderRetryCampaign,
  founderRetryCrmJob,
} from "@/modules/admin/ops";

const founder = "founder@nudge.test";
const reason = "Investigating a customer delivery incident.";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.auditLog.create.mockResolvedValue({});
  prisma.campaign.findFirst.mockResolvedValue({
    id: "campaign-1",
    name: "September recall",
    status: "SENT",
    orgId: "org-1",
    org: { name: "Glow", suspendedAt: null },
  });
  prisma.crmSyncJob.findFirst.mockResolvedValue({
    id: "job-1",
    orgId: "org-1",
    provider: "zoho",
    event: "contact.created",
    status: "dead",
    org: { name: "Glow", suspendedAt: null },
  });
  prisma.crmSyncJob.updateMany.mockResolvedValue({ count: 1 });
  prisma.template.findFirst.mockResolvedValue({
    id: "template-1",
    orgId: "org-1",
    name: "appointment_reminder",
    campaignId: null,
    metaStatus: "PENDING",
    org: { name: "Glow", suspendedAt: null },
  });
  retryFailedMessages.mockResolvedValue({ retried: 2, skippedNoConsent: 1 });
  refreshLibraryTemplateStatus.mockResolvedValue({ id: "template-1", metaStatus: "APPROVED" });
});

describe("campaign recovery", () => {
  it("rejects cross-org, suspended, completed and incorrectly confirmed records", async () => {
    prisma.campaign.findFirst.mockResolvedValueOnce(null);
    expect((await founderRetryCampaign("org-2", "campaign-1", founder, reason, "September recall")).ok).toBe(false);

    prisma.campaign.findFirst.mockResolvedValueOnce({
      id: "campaign-1", name: "September recall", status: "SENT", orgId: "org-1", org: { name: "Glow", suspendedAt: new Date() },
    });
    expect((await founderRetryCampaign("org-1", "campaign-1", founder, reason, "September recall")).ok).toBe(false);

    prisma.campaign.findFirst.mockResolvedValueOnce({
      id: "campaign-1", name: "September recall", status: "DRAFT", orgId: "org-1", org: { name: "Glow", suspendedAt: null },
    });
    expect((await founderRetryCampaign("org-1", "campaign-1", founder, reason, "September recall")).ok).toBe(false);
    expect((await founderRetryCampaign("org-1", "campaign-1", founder, reason, "wrong")).ok).toBe(false);
    expect(retryFailedMessages).not.toHaveBeenCalled();
  });

  it("uses the consent-safe retry and makes duplicate invocation a no-op", async () => {
    const first = await founderRetryCampaign("org-1", "campaign-1", founder, reason, "September recall");
    expect(first).toMatchObject({ ok: true });
    expect(retryFailedMessages).toHaveBeenCalledWith("campaign-1", "org-1");
    expect(prisma.auditLog.create.mock.calls.map(([call]) => call.data.action)).toEqual([
      "admin.operation_requested",
      "admin.operation_completed",
    ]);

    retryFailedMessages.mockResolvedValueOnce({ retried: 0, skippedNoConsent: 0 });
    const duplicate = await founderRetryCampaign("org-1", "campaign-1", founder, reason, "September recall");
    expect(duplicate.ok).toBe(false);
  });
});

describe("CRM recovery", () => {
  it("permits only dead, idempotent jobs in active workspaces", async () => {
    prisma.crmSyncJob.findFirst.mockResolvedValueOnce({
      id: "job-1", orgId: "org-1", provider: "zoho", event: "conversation.summary", status: "dead", org: { name: "Glow", suspendedAt: null },
    });
    expect((await founderRetryCrmJob("org-1", "job-1", founder, reason, "job-1")).ok).toBe(false);

    prisma.crmSyncJob.findFirst.mockResolvedValueOnce({
      id: "job-1", orgId: "org-1", provider: "zoho", event: "contact.created", status: "done", org: { name: "Glow", suspendedAt: null },
    });
    expect((await founderRetryCrmJob("org-1", "job-1", founder, reason, "job-1")).ok).toBe(false);

    prisma.crmSyncJob.findFirst.mockResolvedValueOnce({
      id: "job-1", orgId: "org-1", provider: "zoho", event: "contact.created", status: "dead", org: { name: "Glow", suspendedAt: new Date() },
    });
    expect((await founderRetryCrmJob("org-1", "job-1", founder, reason, "job-1")).ok).toBe(false);
    expect(prisma.crmSyncJob.updateMany).not.toHaveBeenCalled();
  });

  it("claims exactly one dead job so a duplicate retry cannot requeue it", async () => {
    expect((await founderRetryCrmJob("org-1", "job-1", founder, reason, "job-1")).ok).toBe(true);
    expect(prisma.crmSyncJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", orgId: "org-1", status: "dead", event: { in: ["contact.created", "lead.qualified"] } },
      data: { status: "pending", attempts: 0, error: null, nextRunAt: expect.any(Date) },
    });
    prisma.crmSyncJob.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await founderRetryCrmJob("org-1", "job-1", founder, reason, "job-1")).ok).toBe(false);
  });
});

describe("template recovery", () => {
  it("allows only pending campaign-less templates in active workspaces", async () => {
    prisma.template.findFirst.mockResolvedValueOnce(null);
    expect((await founderRefreshTemplate("org-2", "template-1", founder, reason, "appointment_reminder")).ok).toBe(false);

    prisma.template.findFirst.mockResolvedValueOnce({
      id: "template-1", orgId: "org-1", name: "appointment_reminder", campaignId: "campaign-1", metaStatus: "PENDING", org: { name: "Glow", suspendedAt: null },
    });
    expect((await founderRefreshTemplate("org-1", "template-1", founder, reason, "appointment_reminder")).ok).toBe(false);

    prisma.template.findFirst.mockResolvedValueOnce({
      id: "template-1", orgId: "org-1", name: "appointment_reminder", campaignId: null, metaStatus: "APPROVED", org: { name: "Glow", suspendedAt: null },
    });
    expect((await founderRefreshTemplate("org-1", "template-1", founder, reason, "appointment_reminder")).ok).toBe(false);
    expect(refreshLibraryTemplateStatus).not.toHaveBeenCalled();
  });

  it("audits a stable category rather than a raw provider failure", async () => {
    refreshLibraryTemplateStatus.mockRejectedValueOnce(new Error("Bearer secret-provider-token"));
    const result = await founderRefreshTemplate("org-1", "template-1", founder, reason, "appointment_reminder");
    expect(result.ok).toBe(false);
    const failedAudit = prisma.auditLog.create.mock.calls.at(-1)?.[0].data;
    expect(failedAudit.action).toBe("admin.operation_failed");
    expect(failedAudit.detail).toContain("template_refresh_failed");
    expect(failedAudit.detail).not.toContain("secret-provider-token");
  });
});
