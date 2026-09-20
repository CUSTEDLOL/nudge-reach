import { prisma } from "@/lib/db";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import {
  buildBusinessInfo,
  getConciergeStatus,
  installVerticalPack,
  VERTICAL_PACKS,
  type KnowledgeBaseInput,
} from "@/modules/concierge";
import {
  installRevenueRecoveryPack,
  saveFollowUpFromSpec,
  setFollowUpEnabled,
  writeStarterSet,
} from "@/modules/followup/install";
import { draftFollowUp } from "@/modules/followup/draft";
import { parseFollowUpSpec, specErrorMessage } from "@/modules/followup/spec";
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
      // No leadNudge: the quiet-lead nudge is an automation now (it shows in
      // the Follow-ups card), not a flag on this config.
      select: { enabled: true, bookingReminders: true, noShowRebook: true, postServiceReview: true, reminderCalls: true },
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
  // Not a raw config write: the quiet-lead nudge is its own automation, and a
  // founder pause that left it enabled kept sending while the client's page
  // showed dead switches.
  await setFollowUpEnabled(orgId, enabled);
  await founderAudit(orgId, founderEmail, "admin.followups_toggled", null, withReason(enabled ? "on" : "off", reason));
  return { ok: true, message: `Follow-ups ${enabled ? "on" : "off"}.` };
}

/**
 * Concierge drafting: one follow-up from a sentence, or the whole starter set
 * when `request` is empty — the same path the client's Follow-ups page uses,
 * so onboarding produces exactly what they will later see. Everything lands
 * OFF; the client switches it on.
 *
 * Deliberately NOT flagship-gated: the founder sets a client up before they
 * are billed, and `founderSetupClient`'s gate already covers going live. But
 * drafting spends AI on us, so a below-plan draft says so in the founder's
 * toast AND in the org's audit row — never silently.
 */
export async function founderDraftFollowUps(
  orgId: string,
  request: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { ok: false, error: "Org not found." };
  const gate = await checkAiFrontDesk(orgId);
  const offPlan = gate.allowed ? "" : "below the AI Front Desk plan";

  let created = 0;
  let note = "";
  const sentence = request.trim();
  if (sentence) {
    let spec;
    try {
      spec = await draftFollowUp({ orgId, request: sentence.slice(0, 500) });
    } catch (err) {
      // The drafter's own message is the useful one ("try rephrasing").
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't draft that follow-up." };
    }
    // Defence in depth, exactly like the client's create action.
    const parsed = parseFollowUpSpec(spec);
    if (!parsed.ok) return { ok: false, error: specErrorMessage(parsed.error) };
    await saveFollowUpFromSpec({ orgId, spec: parsed.spec, source: "ai" });
    created = 1;
  } else {
    const outcome = await writeStarterSet(orgId);
    created = outcome.created;
    note = outcome.draftFailed
      ? "Installed the ready-made pack, but couldn't draft the extra ones just now."
      : outcome.stopped
        ? "Stopped there — that's as many automations as this plan allows."
        : outcome.failed
          ? "Something went wrong after that, so the rest weren't written."
          : "";
  }

  await founderAudit(
    orgId,
    founderEmail,
    "admin.followups_drafted",
    null,
    withReason(`${created} drafted${offPlan ? ` ${offPlan}` : ""}`, reason)
  );
  const headline = created
    ? `Drafted ${created} follow-up${created === 1 ? "" : "s"} — off until the client switches them on.`
    : note
      ? ""
      : "Nothing new — this client already has these follow-ups.";
  return {
    ok: true,
    message: [headline, note, offPlan && `This workspace is ${offPlan}, so the drafting ran on us.`]
      .filter(Boolean)
      .join(" "),
  };
}
