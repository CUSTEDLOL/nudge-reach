import { prisma } from "@/lib/db";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import {
  buildBusinessInfo,
  getConciergeStatus,
  installVerticalPack,
  VERTICAL_PACKS,
  type KnowledgeBaseInput,
} from "@/modules/concierge";
import { installRevenueRecoveryPack } from "@/modules/followup/install";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";

/**
 * The done-for-you moat, run from the founder side. Same steps as the
 * client's Settings → Concierge (knowledge base → persona on → vertical
 * template pack → follow-up pack), same flagship gate, plus the two switches
 * a founder flips during onboarding calls: agent on/off, follow-ups on/off.
 */
export const CONCIERGE_VERTICALS = Object.keys(VERTICAL_PACKS);

export async function frontDeskOverview(orgId: string) {
  const [profile, knowledge, pendingQuestions, followUp, templates, customActions, status] = await Promise.all([
    prisma.agentProfile.findUnique({
      where: { orgId },
      select: { enabled: true, vertical: true, businessName: true, tone: true, doNots: true, businessInfo: true, updatedAt: true },
    }),
    prisma.knowledgeEntry.groupBy({ by: ["status"], where: { orgId }, _count: true }),
    prisma.ownerQuestion.count({ where: { orgId, status: "pending" } }),
    prisma.followUpConfig.findUnique({
      where: { orgId },
      select: { enabled: true, bookingReminders: true, noShowRebook: true, postServiceReview: true, leadNudge: true, reminderCalls: true },
    }),
    prisma.template.findMany({
      where: { orgId, campaignId: null },
      select: { name: true, category: true, metaStatus: true, rejectionReason: true, submittedAt: true },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.customAction.count({ where: { orgId, enabled: true } }),
    getConciergeStatus(orgId),
  ]);
  const kb: Record<string, number> = { active: 0, draft: 0, archived: 0 };
  for (const row of knowledge) kb[row.status] = row._count;
  return {
    profile: profile
      ? { ...profile, businessInfoChars: profile.businessInfo.length, businessInfo: undefined }
      : null,
    knowledge: kb,
    pendingQuestions,
    followUp,
    templates,
    customActions,
    status,
  };
}
export type FrontDeskOverview = Awaited<ReturnType<typeof frontDeskOverview>>;

export interface ClientSetupInput extends KnowledgeBaseInput {
  businessName: string;
  vertical: string;
  tone?: string;
  doNots?: string;
}

/** One-pass client setup. Refuses (with the plan message) below the flagship. */
export async function founderSetupClient(
  orgId: string,
  input: ClientSetupInput,
  founderEmail: string
): Promise<FounderResult> {
  const businessName = input.businessName.trim();
  if (!businessName) return { ok: false, error: "Enter the client's business name." };
  const vertical = CONCIERGE_VERTICALS.includes(input.vertical) ? input.vertical : null;
  if (!vertical) return { ok: false, error: `Pick a vertical: ${CONCIERGE_VERTICALS.join(", ")}.` };
  const gate = await checkAiFrontDesk(orgId);
  if (!gate.allowed) return { ok: false, error: `${gate.message} (Change the plan under Controls first.)` };
  const businessInfo = buildBusinessInfo(input);
  if (!businessInfo) return { ok: false, error: "Add at least the hours and services so the agent has something real to say." };
  const tone = input.tone?.trim() || "Warm, friendly, and concise";
  const doNots = input.doNots?.trim() ?? "";
  await prisma.agentProfile.upsert({
    where: { orgId },
    create: { orgId, vertical, businessName, businessInfo, tone, doNots, enabled: true },
    update: { vertical, businessName, businessInfo, tone, doNots, enabled: true },
  });
  await prisma.org.update({ where: { id: orgId }, data: { vertical } });
  const packCount = await installVerticalPack(orgId, vertical);
  await installRevenueRecoveryPack(orgId);
  await founderAudit(orgId, founderEmail, "admin.client_setup", businessName, `${vertical} · ${packCount} templates · follow-ups on`);
  return {
    ok: true,
    message: `${businessName} set up — agent trained and on, ${packCount} ${vertical} templates installed, follow-ups on. Connect the calendar and a number to finish going live.`,
  };
}

export async function founderSetAgentEnabled(orgId: string, enabled: boolean, founderEmail: string, reason?: string): Promise<FounderResult> {
  const profile = await prisma.agentProfile.findUnique({ where: { orgId }, select: { enabled: true, businessName: true } });
  if (!profile) return { ok: false, error: "No agent profile yet — run client setup first." };
  if (profile.enabled === enabled) return { ok: false, error: `Already ${enabled ? "on" : "off"}.` };
  if (enabled) {
    const gate = await checkAiFrontDesk(orgId);
    if (!gate.allowed) return { ok: false, error: gate.message };
  }
  await prisma.agentProfile.update({ where: { orgId }, data: { enabled } });
  await founderAudit(orgId, founderEmail, "admin.agent_toggled", profile.businessName, withReason(enabled ? "on" : "off", reason));
  return { ok: true, message: `AI Front Desk ${enabled ? "on" : "off"}.` };
}

export async function founderSetFollowUpsEnabled(orgId: string, enabled: boolean, founderEmail: string, reason?: string): Promise<FounderResult> {
  const cfg = await prisma.followUpConfig.findUnique({ where: { orgId }, select: { enabled: true } });
  if (!cfg) return { ok: false, error: "No follow-up config yet — run client setup first." };
  if (cfg.enabled === enabled) return { ok: false, error: `Already ${enabled ? "on" : "off"}.` };
  await prisma.followUpConfig.update({ where: { orgId }, data: { enabled } });
  await founderAudit(orgId, founderEmail, "admin.followups_toggled", null, withReason(enabled ? "on" : "off", reason));
  return { ok: true, message: `Follow-ups ${enabled ? "on" : "off"}.` };
}
