import { prisma } from "@/lib/db";
import { getPlan, PLAN_COST_ALERT_PCT, planPrice } from "@/modules/billing/plans";
import { approxMicroUsd, type Currency, CURRENCY_INFO } from "@/modules/billing/money";
import { aiCostAlert } from "@/modules/analytics/compute";
import {
  classifyHeartbeat,
  deriveOpsSeverity,
  type HealthSeverity,
} from "@/modules/admin/health";
import { retryFailedMessages } from "@/modules/send/queue";
import { refreshLibraryTemplateStatus } from "@/modules/whatsapp/library";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";
import { confirmationMatches, requireReason } from "@/modules/admin/confirmation";

/**
 * Platform-health queries for the founder panel (cross-org module rules
 * apply — see queries.ts). Answers one question: is anything broken or
 * burning money right now?
 */

export interface CostAlertRow {
  orgId: string;
  orgName: string;
  plan: string;
  costMicroUsd30d: number;
  pctOfPlan: number;
}

export const CRM_RETRY_EVENTS = ["contact.created", "lead.qualified"] as const;

function canRetryCrmEvent(event: string): boolean {
  return (CRM_RETRY_EVENTS as readonly string[]).includes(event);
}

async function auditedRecovery(
  input: {
    orgId: string;
    founderEmail: string;
    target: string;
    reason: string;
    requestedDetail: string;
    failureCategory: string;
    failureMessage: string;
  },
  work: () => Promise<{ message: string; detail: string }>
): Promise<FounderResult> {
  await founderAudit(
    input.orgId,
    input.founderEmail,
    "admin.operation_requested",
    input.target,
    withReason(input.requestedDetail, input.reason)
  );
  try {
    const result = await work();
    await founderAudit(
      input.orgId,
      input.founderEmail,
      "admin.operation_completed",
      input.target,
      result.detail
    );
    return { ok: true, message: result.message };
  } catch {
    await founderAudit(
      input.orgId,
      input.founderEmail,
      "admin.operation_failed",
      input.target,
      withReason(input.failureCategory, input.reason)
    );
    return { ok: false, error: input.failureMessage };
  }
}

export async function founderRetryCampaign(
  orgId: string,
  campaignId: string,
  founderEmail: string,
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
    select: {
      id: true,
      orgId: true,
      name: true,
      status: true,
      org: { select: { name: true, suspendedAt: true } },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found in this workspace." };
  if (campaign.org.suspendedAt) return { ok: false, error: "Lift the workspace suspension before retrying sends." };
  if (campaign.status !== "SENT" && campaign.status !== "SENDING") {
    return { ok: false, error: "Only failures from a sent campaign can be retried." };
  }
  if (!confirmationMatches(campaign.name, confirmation ?? "")) {
    return { ok: false, error: `Type "${campaign.name}" exactly to confirm.` };
  }
  return auditedRecovery(
    {
      orgId,
      founderEmail,
      target: `Campaign ${campaign.name}`,
      reason: requiredReason.value,
      requestedDetail: `retry failed messages for campaign ${campaign.id}`,
      failureCategory: "campaign_retry_failed",
      failureMessage: "Campaign retry could not be completed safely.",
    },
    async () => {
      const result = await retryFailedMessages(campaign.id, orgId);
      if (result.retried === 0) throw new Error("no eligible failures");
      return {
        message: `Retrying ${result.retried} failed message${result.retried === 1 ? "" : "s"}${result.skippedNoConsent ? `; ${result.skippedNoConsent} skipped without consent` : ""}.`,
        detail: `campaign_retry_completed: ${result.retried} retried, ${result.skippedNoConsent} skipped_no_consent`,
      };
    }
  );
}

export async function founderRetryCrmJob(
  orgId: string,
  jobId: string,
  founderEmail: string,
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const job = await prisma.crmSyncJob.findFirst({
    where: { id: jobId, orgId },
    select: {
      id: true,
      orgId: true,
      provider: true,
      event: true,
      status: true,
      org: { select: { name: true, suspendedAt: true } },
    },
  });
  if (!job) return { ok: false, error: "CRM job not found in this workspace." };
  if (job.org.suspendedAt) return { ok: false, error: "Lift the workspace suspension before retrying CRM work." };
  if (job.status !== "dead") return { ok: false, error: "This CRM job is no longer awaiting recovery." };
  if (!canRetryCrmEvent(job.event)) {
    return { ok: false, error: "This CRM event is diagnostic-only and cannot be retried safely." };
  }
  if (!confirmationMatches(job.id, confirmation ?? "")) {
    return { ok: false, error: `Type "${job.id}" exactly to confirm.` };
  }
  return auditedRecovery(
    {
      orgId,
      founderEmail,
      target: `CRM job ${job.id}`,
      reason: requiredReason.value,
      requestedDetail: `requeue ${job.provider}:${job.event}`,
      failureCategory: "crm_retry_failed",
      failureMessage: "CRM retry could not be queued safely.",
    },
    async () => {
      const claimed = await prisma.crmSyncJob.updateMany({
        where: {
          id: job.id,
          orgId,
          status: "dead",
          event: { in: [...CRM_RETRY_EVENTS] },
        },
        data: { status: "pending", attempts: 0, error: null, nextRunAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("already claimed");
      return {
        message: `${job.provider} job queued for retry.`,
        detail: `crm_retry_queued: ${job.provider}:${job.event}`,
      };
    }
  );
}

export async function founderRefreshTemplate(
  orgId: string,
  templateId: string,
  founderEmail: string,
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId },
    select: {
      id: true,
      orgId: true,
      name: true,
      campaignId: true,
      metaStatus: true,
      org: { select: { name: true, suspendedAt: true } },
    },
  });
  if (!template) return { ok: false, error: "Template not found in this workspace." };
  if (template.org?.suspendedAt) return { ok: false, error: "Lift the workspace suspension before refreshing templates." };
  if (template.campaignId !== null || template.metaStatus !== "PENDING") {
    return { ok: false, error: "Only a pending library template can be refreshed." };
  }
  if (!confirmationMatches(template.name, confirmation ?? "")) {
    return { ok: false, error: `Type "${template.name}" exactly to confirm.` };
  }
  return auditedRecovery(
    {
      orgId,
      founderEmail,
      target: `Template ${template.name}`,
      reason: requiredReason.value,
      requestedDetail: `refresh template status for ${template.id}`,
      failureCategory: "template_refresh_failed",
      failureMessage: "Template status could not be refreshed safely.",
    },
    async () => {
      const refreshed = await refreshLibraryTemplateStatus(template.id, orgId);
      if (!refreshed) throw new Error("template disappeared");
      return {
        message: `Template status refreshed: ${refreshed.metaStatus.toLowerCase()}.`,
        detail: `template_refresh_completed: ${refreshed.metaStatus.toLowerCase()}`,
      };
    }
  );
}

/** Pure: join per-org cost onto plan prices and keep the over-threshold rows. */
export function buildCostAlerts(
  rows: {
    orgId: string;
    orgName: string;
    plan: string;
    currency: string;
    costMicroUsd30d: number;
  }[]
): CostAlertRow[] {
  const alerts: CostAlertRow[] = [];
  for (const r of rows) {
    const currency = (r.currency in CURRENCY_INFO ? r.currency : "INR") as Currency;
    const priceMicroUsd = approxMicroUsd(planPrice(getPlan(r.plan), currency), currency);
    const alert = aiCostAlert(r.costMicroUsd30d, priceMicroUsd, PLAN_COST_ALERT_PCT);
    if (alert?.over) {
      alerts.push({
        orgId: r.orgId,
        orgName: r.orgName,
        plan: r.plan,
        costMicroUsd30d: r.costMicroUsd30d,
        pctOfPlan: Math.round(alert.pct),
      });
    }
  }
  return alerts.sort((a, b) => b.pctOfPlan - a.pctOfPlan);
}

export async function opsOverview(now = new Date()) {
  const since15m = new Date(now.getTime() - 15 * 60 * 1000);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    heartbeatRow,
    queuedGroups,
    failedGroups,
    deadCrmJobRows,
    webhookFailures,
    stuckTemplates,
    lastAutomationRun,
    lastOutbound,
    lastAiCall,
    topCost,
  ] =
    await Promise.all([
      prisma.systemHeartbeat.findUnique({
        where: { key: "process-queue" },
        select: { status: true, detail: true, lastSeenAt: true },
      }),
      prisma.message.groupBy({
        by: ["campaignId"],
        where: { status: "QUEUED", createdAt: { lt: since15m } },
        _count: true,
        _min: { createdAt: true },
        orderBy: { campaignId: "asc" },
        take: 50,
      }),
      prisma.message.groupBy({
        by: ["campaignId"],
        where: { status: "FAILED" },
        _count: true,
        _max: { updatedAt: true },
        orderBy: { campaignId: "asc" },
        take: 50,
      }),
      prisma.crmSyncJob.findMany({
        where: { status: "dead" },
        select: {
          id: true,
          orgId: true,
          provider: true,
          event: true,
          attempts: true,
          updatedAt: true,
          org: { select: { id: true, name: true, suspendedAt: true } },
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
      }),
      prisma.webhookDelivery.findMany({
        where: { ok: false, createdAt: { gte: since7 } },
        select: {
          id: true,
          event: true,
          status: true,
          error: true,
          createdAt: true,
          endpoint: { select: { url: true, org: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.template.findMany({
        where: {
          campaignId: null,
          OR: [
            { metaStatus: "REJECTED" },
            { metaStatus: "PENDING", submittedAt: { lt: since24h } },
          ],
        },
        select: {
          id: true,
          name: true,
          metaStatus: true,
          rejectionReason: true,
          submittedAt: true,
          org: { select: { id: true, name: true, suspendedAt: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 25,
      }),
      prisma.automationRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.conversationMessage.findFirst({
        where: { direction: "outbound" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.aiUsage.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.aiUsage.groupBy({
        by: ["orgId"],
        where: { createdAt: { gte: since30 } },
        _sum: { costMicroUsd: true },
        orderBy: { _sum: { costMicroUsd: "desc" } },
        take: 50,
      }),
    ]);

  const incidentCampaignIds = [
    ...new Set([...queuedGroups, ...failedGroups].map((group) => group.campaignId)),
  ];
  const incidentCampaigns = await prisma.campaign.findMany({
    where: { id: { in: incidentCampaignIds } },
    select: {
      id: true,
      name: true,
      status: true,
      org: { select: { id: true, name: true, suspendedAt: true } },
    },
  });
  const campaignById = new Map(incidentCampaigns.map((campaign) => [campaign.id, campaign]));
  const queuedCampaigns = queuedGroups.flatMap((group) => {
    const campaign = campaignById.get(group.campaignId);
    return campaign
      ? [{
          campaignId: campaign.id,
          campaignName: campaign.name,
          orgId: campaign.org.id,
          orgName: campaign.org.name,
          count: group._count,
          oldestAt: group._min.createdAt,
        }]
      : [];
  });
  const failedCampaigns = failedGroups.flatMap((group) => {
    const campaign = campaignById.get(group.campaignId);
    return campaign
      ? [{
          campaignId: campaign.id,
          campaignName: campaign.name,
          orgId: campaign.org.id,
          orgName: campaign.org.name,
          count: group._count,
          latestAt: group._max.updatedAt,
          retryEligible:
            !campaign.org.suspendedAt &&
            (campaign.status === "SENT" || campaign.status === "SENDING"),
        }]
      : [];
  });
  const deadCrmJobs = deadCrmJobRows.map((job) => ({
    ...job,
    retryEligible: !job.org.suspendedAt && canRetryCrmEvent(job.event),
    retryBlockedReason: job.org.suspendedAt
      ? "Workspace is suspended"
      : canRetryCrmEvent(job.event)
        ? null
        : "Diagnostic-only event",
  }));

  const costOrgs = await prisma.org.findMany({
    where: { id: { in: topCost.map((g) => g.orgId) } },
    select: { id: true, name: true, plan: true, currency: true },
  });
  const orgById = new Map(costOrgs.map((o) => [o.id, o]));
  const costAlerts = buildCostAlerts(
    topCost.flatMap((g) => {
      const org = orgById.get(g.orgId);
      return org
        ? [
            {
              orgId: org.id,
              orgName: org.name,
              plan: org.plan,
              currency: org.currency,
              costMicroUsd30d: g._sum.costMicroUsd ?? 0,
            },
          ]
        : [];
    })
  );

  const heartbeatFreshness = classifyHeartbeat(heartbeatRow?.lastSeenAt ?? null, now);
  const heartbeatSeverity: HealthSeverity =
    heartbeatRow?.status === "error" ? "critical" : heartbeatFreshness;
  const incidentCounts = {
    staleQueued: queuedCampaigns.reduce((sum, row) => sum + row.count, 0),
    failedMessages: failedCampaigns.reduce((sum, row) => sum + row.count, 0),
    deadCrmJobs: deadCrmJobs.length,
    webhookFailures: webhookFailures.length,
    stuckTemplates: stuckTemplates.length,
    costAlerts: costAlerts.length,
  };

  return {
    heartbeat: {
      status: heartbeatRow?.status ?? "unknown",
      detail: heartbeatRow?.detail ?? {},
      lastSeenAt: heartbeatRow?.lastSeenAt ?? null,
      freshness: heartbeatFreshness,
    },
    severity: deriveOpsSeverity({ heartbeat: heartbeatSeverity, ...incidentCounts }),
    incidentCounts,
    queuedCampaigns,
    failedCampaigns,
    deadCrmJobs,
    webhookFailures,
    // Campaign-less template rows should always carry an org; drop any
    // legacy row that doesn't rather than rendering a broken link.
    stuckTemplates: stuckTemplates.flatMap((t) =>
      t.org ? [{ ...t, org: t.org }] : []
    ),
    lastActivity: {
      automationRunAt: lastAutomationRun?.createdAt ?? null,
      outboundMessageAt: lastOutbound?.createdAt ?? null,
      aiCallAt: lastAiCall?.createdAt ?? null,
    },
    costAlerts,
  };
}
