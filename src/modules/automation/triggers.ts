/**
 * Automation trigger entry points (spec §M6). Call sites fire these after the
 * underlying mutation commits; failures are swallowed so a broken automation
 * can never break the primary action.
 *
 * Signatures are frozen: M2/M3 already call them. Loop safety: the add_tag
 * step executor never calls fireTagAdded, so automations adding tags cannot
 * cascade into more tag_added runs.
 */

import { prisma } from "@/lib/db";
import {
  matchAutomations,
  runAutomation,
  MAX_AUTOMATIONS_PER_EVENT,
  type AutomationWithSteps,
} from "@/modules/automation/engine";
import { parseQuietConfig } from "@/modules/automation/definitions";
import { planHasAiFrontDesk } from "@/modules/billing/limits";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";

export interface TriggerContext {
  contactId: string;
  conversationId?: string;
  /** Inbound message text, for keyword/campaign_reply triggers. */
  messageText?: string;
  /** Tag name, for tag_added triggers. */
  tagName?: string;
}

export async function fireContactCreated(
  orgId: string,
  contactId: string
): Promise<void> {
  // Notify integrations subscribed to new contacts (fire-and-forget).
  void dispatchWebhook(orgId, "contact.created", { contactId });
  try {
    const matched = await matchAutomations("contact_created", { orgId });
    await runMatched(matched, orgId, contactId, "contact_created");
  } catch (error) {
    console.error("[automations] fireContactCreated failed", error);
  }
}

export async function fireBookingCreated(
  orgId: string,
  contactId: string,
  bookingId: string
): Promise<void> {
  // Only ever runs outbound sends → never re-enters inbound (loop-safe, same
  // guarantee as the other triggers).
  void dispatchWebhook(orgId, "booking.created", { bookingId, contactId });
  try {
    const matched = await matchAutomations("booking_created", { orgId });
    await runMatched(matched, orgId, contactId, "booking_created");
  } catch (error) {
    console.error("[automations] fireBookingCreated failed", error);
  }
}

export async function fireTagAdded(
  orgId: string,
  contactId: string,
  tagName: string
): Promise<void> {
  try {
    const matched = await matchAutomations("tag_added", { orgId, tagName });
    await runMatched(matched, orgId, contactId, "tag_added");
  } catch (error) {
    console.error("[automations] fireTagAdded failed", error);
  }
}

/** Run up to MAX_AUTOMATIONS_PER_EVENT matches; log (never throw) per run. */
async function runMatched(
  matched: AutomationWithSteps[],
  orgId: string,
  contactId: string,
  event: string
): Promise<void> {
  if (matched.length > MAX_AUTOMATIONS_PER_EVENT) {
    console.warn(
      `[automations] ${matched.length} automations matched one ${event} event ` +
        `(org ${orgId}); capping at ${MAX_AUTOMATIONS_PER_EVENT}.`
    );
  }
  for (const automation of matched.slice(0, MAX_AUTOMATIONS_PER_EVENT)) {
    try {
      await runAutomation(automation, { orgId, contactId });
    } catch (error) {
      console.error(
        `[automations] run of "${automation.name}" (${automation.id}) failed`,
        error
      );
    }
  }
}

const QUIET_BATCH = 200;
/** Only threads that went quiet in the past week — switching a chase on must not drain months of stale threads. */
const QUIET_LOOKBACK_MS = 7 * 24 * 3_600_000;

/**
 * The outbound moat's trigger: a customer who messaged us (so they showed
 * interest) and the thread has since been silent in both directions for the
 * configured hours. Runs on the cron tick. One chase per contact per
 * automation, ever — enforced by excluding anyone with an existing run that
 * got past its first send — so a nightly tick can never double-send. Like the
 * reminder tick, gated on the AI Front Desk plan at runtime: an org that
 * downgraded stops chasing even though its automations stay enabled.
 * Returns how many runs were started.
 */
export async function fireQuietConversations(now: Date = new Date()): Promise<number> {
  const automations = await prisma.automation.findMany({
    where: { enabled: true, trigger: "conversation_quiet" },
    include: { steps: { orderBy: { order: "asc" } }, org: { select: { plan: true } } },
  });
  let started = 0;
  for (const automation of automations) {
    if (!automation.steps.length || !planHasAiFrontDesk(automation.org.plan)) continue;
    // A chase started while a template is still pending at Meta would FAIL and
    // the one-run cap would then exclude that contact forever — so start nothing
    // until every send template is approved; the contacts stay eligible.
    const templateIds = automation.steps
      .filter((s) => s.kind === "send_template")
      .map((s) => {
        const { templateId } = (s.config ?? {}) as { templateId?: unknown };
        return typeof templateId === "string" ? templateId : "";
      })
      .filter(Boolean);
    // Invariant #2: a MARKETING chase reaches only opted-in contacts — selected
    // up front so the consent gate in sendMessage never turns a lead into a
    // FAILED run.
    let needsOptIn = false;
    if (templateIds.length) {
      const templates = await prisma.template.findMany({
        where: { orgId: automation.orgId, id: { in: templateIds } },
        select: { id: true, metaStatus: true, category: true },
      });
      const approved = new Set(templates.filter((t) => t.metaStatus === "APPROVED").map((t) => t.id));
      if (!templateIds.every((id) => approved.has(id))) continue;
      needsOptIn = templates.some((t) => t.category === "MARKETING");
    }
    const { hours, stage } = parseQuietConfig(automation.triggerConfig);
    const cutoff = new Date(now.getTime() - hours * 3_600_000);
    // A FAILED run that never sent (step 1 is always the first send for a
    // went_quiet spec) does not burn the cap: a suspended org re-attempts each
    // tick until unsuspended — bounded and intended.
    const priorRuns = await prisma.automationRun.findMany({
      where: {
        automationId: automation.id,
        contactId: { not: null },
        NOT: { status: "FAILED", currentStep: { lte: 1 } },
      },
      select: { contactId: true },
    });
    const conversations = await prisma.conversation.findMany({
      where: {
        orgId: automation.orgId,
        channel: "whatsapp",
        status: { in: ["open", "pending"] },
        // Quiet in both directions: a staff reply from the inbox postpones the chase.
        lastInboundAt: { not: null, gt: new Date(cutoff.getTime() - QUIET_LOOKBACK_MS), lte: cutoff },
        lastMessageAt: { lte: cutoff },
        contactId: { notIn: priorRuns.map((r) => r.contactId as string) },
        contact: {
          optedOutAt: null,
          ...(needsOptIn ? { optedIn: true } : {}),
          ...(stage ? { leadStage: stage } : {}),
        },
      },
      select: { id: true, contactId: true },
      orderBy: { lastInboundAt: "asc" },
      take: QUIET_BATCH,
    });
    for (const c of conversations) {
      try {
        await runAutomation(automation, { orgId: automation.orgId, contactId: c.contactId, conversationId: c.id });
        started++;
      } catch (error) {
        console.error(`[automations] quiet chase "${automation.name}" (${automation.id}) failed`, error);
      }
    }
  }
  return started;
}
