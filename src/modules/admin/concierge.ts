import { prisma } from "@/lib/db";
import { checkAiFrontDesk, checkAutomationLimit } from "@/modules/billing/limits";
import {
  buildBusinessInfo,
  getConciergeStatus,
  installClientGrounding,
  installStarterPack,
  type KnowledgeBaseInput,
} from "@/modules/concierge";
import {
  installRevenueRecoveryPack,
  saveFollowUpFromSpec,
  setFollowUpEnabled,
  writeStarterSet,
} from "@/modules/followup/install";
import { draftFollowUp } from "@/modules/followup/draft";
import { migrateProfileToRules } from "@/modules/agent/migrate-profile";
import { parseFollowUpSpec, specErrorMessage } from "@/modules/followup/spec";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";
import { VERTICALS } from "@/modules/dashboard/verticals";

/**
 * The done-for-you moat, run from the founder side. Same steps as the
 * client's Settings → Concierge (knowledge base → persona on → vertical
 * template pack → follow-up pack), same flagship gate, plus the two switches
 * a founder flips during onboarding calls: agent on/off, follow-ups on/off.
 */
export const CONCIERGE_VERTICALS: string[] = VERTICALS.map((v) => v.value);

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

/**
 * One-pass client setup. Refuses (with the plan message) below the flagship.
 *
 * Same two writes as the client-side action: `installClientGrounding` writes the
 * rows the agent reads, and `businessInfo`/`doNots` keep the operator's own text
 * for the form to read back. Only the first reaches a prompt.
 */
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
  const grounding = await installClientGrounding(orgId, input, doNots);
  const packCount = await installStarterPack(orgId);
  await installRevenueRecoveryPack(orgId);
  await founderAudit(orgId, founderEmail, "admin.client_setup", businessName, `${vertical} · ${packCount} templates · follow-ups on · ${grounding.facts} facts · ${grounding.rules} rules`);
  // The counts are what this run CREATED: a re-run that changed nothing says
  // "+0 facts", which is the truth a founder needs to see.
  const turnedBack = grounding.rulesRejected
    ? ` ${grounding.rulesRejected} do-not line${grounding.rulesRejected === 1 ? "" : "s"} could not become a rule — reword ${grounding.rulesRejected === 1 ? "it" : "them"} on Training.`
    : "";
  return {
    ok: true,
    message: `${businessName} set up — agent trained and on (+${grounding.facts} facts, +${grounding.rules} house rules), ${packCount} ${vertical} templates installed, follow-ups on.${turnedBack} Connect the calendar and a number to finish going live.`,
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
 * so onboarding produces exactly what they will later see. Drafted follow-ups
 * land OFF; the ready-made pack is switched on only on a FIRST install (a
 * re-run never un-pauses a client — see `installRevenueRecoveryPack`).
 *
 * Deliberately NOT flagship-gated: the founder sets a client up before they
 * are billed, and `founderSetupClient`'s gate already covers going live. The
 * drafting is metered as `concierge_draft`, which the ledger absorbs — Nudge
 * pays, and a trial or zero-credit org (what onboarding starts from) is never
 * refused. A below-plan draft still says so, in the toast and in the org's
 * audit row.
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
  let target: string | null = null;
  const lines: string[] = [];
  const detail: string[] = [];
  const sentence = request.trim();
  if (sentence) {
    // Same plan limit the client's own create honours — checked before we
    // spend AI on a follow-up that could not be saved.
    const limit = await checkAutomationLimit(orgId);
    if (!limit.allowed) return { ok: false, error: limit.message };
    let spec;
    try {
      spec = await draftFollowUp({ orgId, request: sentence.slice(0, 500), purpose: "concierge_draft" });
    } catch (err) {
      // The drafter's own message is the useful one ("try rephrasing").
      return { ok: false, error: err instanceof Error ? err.message : "Couldn't draft that follow-up." };
    }
    // Defence in depth, exactly like the client's create action.
    const parsed = parseFollowUpSpec(spec);
    if (!parsed.ok) return { ok: false, error: specErrorMessage(parsed.error) };
    await saveFollowUpFromSpec({ orgId, spec: parsed.spec, source: "ai" });
    created = 1;
    target = parsed.spec.name;
  } else {
    const outcome = await writeStarterSet(orgId, "concierge_draft");
    created = outcome.created;
    if (outcome.draftFailed) lines.push("Couldn't draft the extra ones just now.");
    else if (outcome.stopped) lines.push("Stopped there — that's as many automations as this plan allows.");
    else if (outcome.failed) lines.push("Something went wrong after that, so the rest weren't written.");
    lines.push(
      "Ready-made pack installed — switched on for a new client, left as it is for one already set up."
    );
    detail.push("ready-made pack installed");
  }

  await founderAudit(
    orgId,
    founderEmail,
    "admin.followups_drafted",
    target,
    withReason([`${created} drafted`, ...detail, offPlan].filter(Boolean).join(", "), reason)
  );
  const headline = created
    ? `Drafted ${created} follow-up${created === 1 ? "" : "s"} — off until the client switches them on.`
    : lines.length
      ? ""
      : "Nothing new — this client already has these follow-ups.";
  return {
    ok: true,
    message: [
      headline,
      ...lines,
      offPlan &&
        `This workspace is ${offPlan} — the drafting ran on us, and these won't run until the plan changes.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/**
 * Concierge onboarding, run deliberately: turn the client's legacy Setup boxes
 * (`doNots` and the "what should the assistant know?" free text) into house
 * rules and draft knowledge facts. The Training page does this lazily on the
 * owner's first visit; this is the founder doing it during a setup call,
 * before the owner has ever opened the page.
 *
 * Idempotent and non-destructive — it never clears the legacy columns and
 * re-running it creates nothing. Not flagship-gated for the same reason as
 * the drafting above: onboarding happens before billing, and it costs no AI.
 */
export async function founderMigrateProfile(
  orgId: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { ok: false, error: "Org not found." };

  const { rules, archived, facts, factsArchived } = await migrateProfileToRules(orgId);
  // `factsArchived` counts too: a workspace already at its fact cap can migrate
  // a whole blob into archived facts and nothing else, and that is emphatically
  // not "nothing to migrate".
  if (rules === 0 && archived === 0 && facts === 0 && factsArchived === 0) {
    return { ok: false, error: "Nothing to migrate — already done, or both legacy boxes are empty." };
  }

  // Lines past a cap are written archived rather than dropped — rules since
  // 4a69dae, facts since the cap stopped silently discarding them. The founder
  // needs to know they exist: nothing else surfaces either.
  const overCap = [
    archived
      ? `${archived} more went over the rule cap and were archived — free up rule slots to bring them live.`
      : "",
    factsArchived
      ? `${factsArchived} fact${factsArchived === 1 ? "" : "s"} went over the fact cap and were archived — free up fact slots to bring them back for review.`
      : "",
  ]
    .filter(Boolean)
    .map((sentence) => ` ${sentence}`)
    .join("");

  await founderAudit(
    orgId,
    founderEmail,
    "admin.profile_migrated",
    null,
    withReason(
      `${rules} rules, ${archived} archived, ${facts} draft facts, ${factsArchived} archived facts`,
      reason
    )
  );
  return {
    ok: true,
    message: `Migrated: ${rules} house rule${rules === 1 ? "" : "s"} (live) and ${facts} draft fact${facts === 1 ? "" : "s"} awaiting review.${overCap} The old boxes are untouched.`,
  };
}
