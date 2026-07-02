import type {
  Automation,
  AutomationRunStatus,
  AutomationStep,
  Contact,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/messaging";
import { isWithinServiceWindow } from "@/lib/agent/window";
import { campaignContentSchema } from "@/lib/campaign/schema";
import {
  MAX_AUTOMATIONS_PER_EVENT,
  automationMatchesEvent,
  normalizeLogEntries,
  readWaitMinutes,
  type AutomationTrigger,
  type MatchContext,
  type RunLogEntry,
} from "@/lib/automation/definitions";

// Re-export the pure vocabulary so engine consumers have one import surface.
export * from "@/lib/automation/definitions";

/**
 * Automation engine (spec §M6): matches enabled automations to trigger events
 * and executes their steps sequentially against a contact/conversation,
 * appending a per-step log entry to AutomationRun.log.
 *
 * Loop safety (verified by construction):
 * - Only genuine inbound customer messages (webhook + simulation tester) call
 *   `handleInboundMessage`; every automation send goes OUT through
 *   `sendMessage` and can never re-enter the inbound path, so a send_message
 *   step cannot re-trigger `message_received`.
 * - The add_tag executor deliberately does NOT call `fireTagAdded`, so a
 *   tag_added automation adding tags cannot cascade into more runs.
 */

export type AutomationWithSteps = Automation & { steps: AutomationStep[] };

export interface RunContext {
  orgId: string;
  contactId: string;
  conversationId?: string;
  /** Inbound text that caused the run, when triggered by a message. */
  messageText?: string;
}

export interface RunOutcome {
  runId: string;
  status: AutomationRunStatus;
  /** True when a send_message/send_template step actually sent something. */
  sentMessage: boolean;
  /** Body of the last message this run sent, if any. */
  replyText?: string;
  log: RunLogEntry[];
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Enabled automations of an org whose trigger + config match the event. */
export async function matchAutomations(
  trigger: AutomationTrigger,
  ctx: { orgId: string } & MatchContext
): Promise<AutomationWithSteps[]> {
  const candidates = await prisma.automation.findMany({
    where: { orgId: ctx.orgId, enabled: true, trigger },
    include: { steps: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return candidates.filter(
    (automation) =>
      automation.steps.length > 0 &&
      automationMatchesEvent(automation, trigger, ctx)
  );
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

/** Execute an automation's steps now. Creates the AutomationRun row. */
export async function runAutomation(
  automation: AutomationWithSteps,
  ctx: RunContext
): Promise<RunOutcome> {
  const steps = [...automation.steps].sort((a, b) => a.order - b.order);
  const run = await prisma.automationRun.create({
    data: {
      automationId: automation.id,
      orgId: ctx.orgId,
      contactId: ctx.contactId,
      conversationId: ctx.conversationId ?? null,
    },
  });
  return executeSteps(run.id, ctx, steps, 0, []);
}

/**
 * Resume WAITING runs whose resumeAt has passed, continuing at the step after
 * the wait (currentStep is the 1-based count of steps already processed, so
 * the resume index is exactly `currentStep`). Exported for the integration
 * phase to wire into the cron route — do NOT call it from module UI code.
 * Returns how many runs were resumed.
 */
export async function tickAutomationRuns(now: Date = new Date()): Promise<number> {
  const due = await prisma.automationRun.findMany({
    where: { status: "WAITING", resumeAt: { lte: now } },
    include: { automation: { include: { steps: { orderBy: { order: "asc" } } } } },
    orderBy: { resumeAt: "asc" },
    take: 25,
  });

  let resumed = 0;
  for (const run of due) {
    // Claim atomically so overlapping cron ticks never double-run a step.
    const claimed = await prisma.automationRun.updateMany({
      where: { id: run.id, status: "WAITING" },
      data: { status: "RUNNING", resumeAt: null },
    });
    if (claimed.count === 0) continue;

    const priorLog = normalizeLogEntries(run.log);
    if (!run.contactId) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          log: toJson([
            ...priorLog,
            logEntry(run.currentStep + 1, "resume", false, "Run has no contact to resume against."),
          ]),
        },
      });
      continue;
    }

    const ctx: RunContext = {
      orgId: run.orgId,
      contactId: run.contactId,
      conversationId: run.conversationId ?? undefined,
    };
    try {
      await executeSteps(run.id, ctx, run.automation.steps, run.currentStep, priorLog);
    } catch (error) {
      await prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          log: toJson([
            ...priorLog,
            logEntry(run.currentStep + 1, "resume", false, errorMessage(error)),
          ]),
        },
      });
    }
    resumed++;
  }
  return resumed;
}

/** How long after a campaign message an inbound counts as a campaign reply. */
const CAMPAIGN_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface InboundAutomationResult {
  /** Number of automations that ran for this event. */
  ran: number;
  /** True when any run sent a message — caller must skip the AI auto-reply. */
  replied: boolean;
  replyText?: string;
}

/**
 * Inbound-message dispatch (called from handleInboundMessage BEFORE the AI
 * agent): matches message_received + keyword triggers, plus campaign_reply
 * when the contact got a campaign message in the last 7 days. Runs at most
 * MAX_AUTOMATIONS_PER_EVENT automations (most specific first) and never
 * throws — a broken automation must not break inbound handling.
 */
export async function runInboundAutomations(
  orgId: string,
  ctx: { contactId: string; conversationId: string; messageText: string }
): Promise<InboundAutomationResult> {
  const [keywordMatches, messageMatches] = await Promise.all([
    matchAutomations("keyword", { orgId, text: ctx.messageText }),
    matchAutomations("message_received", { orgId }),
  ]);

  let campaignMatches: AutomationWithSteps[] = [];
  const recentCampaignMessage = await prisma.message.findFirst({
    where: {
      contactId: ctx.contactId,
      campaign: { orgId },
      createdAt: { gte: new Date(Date.now() - CAMPAIGN_REPLY_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (recentCampaignMessage) {
    campaignMatches = await matchAutomations("campaign_reply", { orgId });
  }

  // Most specific first: keyword → campaign_reply → catch-all message_received.
  const unique = new Map<string, AutomationWithSteps>();
  for (const automation of [...keywordMatches, ...campaignMatches, ...messageMatches]) {
    unique.set(automation.id, automation);
  }
  let matched = [...unique.values()];
  if (matched.length > MAX_AUTOMATIONS_PER_EVENT) {
    console.warn(
      `[automations] ${matched.length} automations matched one inbound event ` +
        `(org ${orgId}); capping at ${MAX_AUTOMATIONS_PER_EVENT}.`
    );
    matched = matched.slice(0, MAX_AUTOMATIONS_PER_EVENT);
  }

  const result: InboundAutomationResult = { ran: 0, replied: false };
  for (const automation of matched) {
    try {
      const outcome = await runAutomation(automation, { orgId, ...ctx });
      result.ran++;
      if (outcome.sentMessage) {
        result.replied = true;
        result.replyText = outcome.replyText ?? result.replyText;
      }
    } catch (error) {
      console.error(
        `[automations] run of "${automation.name}" (${automation.id}) failed`,
        error
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

interface StepResult {
  ok: boolean;
  detail: string;
  /** Set when the step sent a message to the customer. */
  replyText?: string;
}

async function executeSteps(
  runId: string,
  ctx: RunContext,
  orderedSteps: AutomationStep[],
  startIndex: number,
  priorLog: RunLogEntry[]
): Promise<RunOutcome> {
  const log = [...priorLog];
  let replyText: string | undefined;

  for (let i = startIndex; i < orderedSteps.length; i++) {
    const step = orderedSteps[i];
    const stepNumber = i + 1;

    if (step.kind === "wait") {
      const minutes = readWaitMinutes(step.config);
      const resumeAt = new Date(Date.now() + minutes * 60_000);
      log.push(
        logEntry(
          stepNumber,
          "wait",
          true,
          `Waiting ${minutes} minute${minutes === 1 ? "" : "s"} — resumes automatically.`
        )
      );
      await prisma.automationRun.update({
        where: { id: runId },
        data: { status: "WAITING", currentStep: stepNumber, resumeAt, log: toJson(log) },
      });
      return outcome(runId, "WAITING", log, replyText);
    }

    let result: StepResult;
    try {
      result = await executeStep(step, ctx);
    } catch (error) {
      result = { ok: false, detail: errorMessage(error) };
    }
    log.push(logEntry(stepNumber, step.kind, result.ok, result.detail));
    if (result.replyText) replyText = result.replyText;

    await prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: result.ok ? "RUNNING" : "FAILED",
        currentStep: stepNumber,
        log: toJson(log),
      },
    });
    if (!result.ok) return outcome(runId, "FAILED", log, replyText);
  }

  await prisma.automationRun.update({
    where: { id: runId },
    data: { status: "COMPLETED", log: toJson(log) },
  });
  return outcome(runId, "COMPLETED", log, replyText);
}

async function executeStep(
  step: AutomationStep,
  ctx: RunContext
): Promise<StepResult> {
  const config = asObject(step.config);
  // Re-fetched per step (org-scoped): state may have changed across a wait.
  const contact = await prisma.contact.findFirst({
    where: { id: ctx.contactId, orgId: ctx.orgId },
  });
  if (!contact) {
    return { ok: false, detail: "Contact no longer exists in this workspace." };
  }

  switch (step.kind) {
    case "send_message":
      return sendMessageStep(contact, config);
    case "send_template":
      return sendTemplateStep(contact, config);
    case "add_tag":
      return addTagStep(contact, config);
    case "assign_agent":
      return assignAgentStep(contact, config);
    case "update_lead_stage":
      return updateLeadStageStep(contact, config);
    case "resolve_conversation":
      return setConversationStatus(contact, ctx, "resolved");
    case "handoff_to_human":
      return setConversationStatus(contact, ctx, "handoff");
    default:
      return { ok: false, detail: `Unknown step kind "${step.kind}".` };
  }
}

/**
 * Free-form text reply. Meta only allows these inside the 24h service window
 * (rule 1 — official API semantics), so the step fails cleanly outside it
 * instead of attempting a policy-violating send.
 */
async function sendMessageStep(
  contact: Contact,
  config: Record<string, unknown>
): Promise<StepResult> {
  const text = String(config.text ?? config.body ?? "").trim();
  if (!text) return { ok: false, detail: "No message text configured." };

  const conversation = await ensureConversation(contact);
  if (!isWithinServiceWindow(conversation.lastInboundAt)) {
    return {
      ok: false,
      detail:
        "24h service window closed — free-form send rejected (template required)",
    };
  }

  const sent = await sendMessage(
    "whatsapp",
    {
      address: contact.phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    { kind: "text", text },
    { orgId: contact.orgId }
  );
  if (!sent.ok) return { ok: false, detail: sent.error ?? "Send failed." };

  await recordOutbound(conversation.id, contact.id, text, sent.providerMessageId);
  return { ok: true, detail: `Sent message to ${contact.name}.`, replyText: text };
}

/**
 * Approved library template send. {{1}} = the contact's first name. The
 * consent gate lives in sendMessage (rule 2) — a MARKETING template to a
 * non-consenting contact comes back blockedByConsent and fails the step.
 */
async function sendTemplateStep(
  contact: Contact,
  config: Record<string, unknown>
): Promise<StepResult> {
  const templateId = typeof config.templateId === "string" ? config.templateId : "";
  if (!templateId) return { ok: false, detail: "No template selected." };

  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId: contact.orgId },
  });
  if (!template) {
    return { ok: false, detail: "Template not found in this workspace's library." };
  }
  if (template.metaStatus !== "APPROVED") {
    return {
      ok: false,
      detail: `Template "${template.name}" is ${template.metaStatus.toLowerCase()} — only approved templates can be sent.`,
    };
  }

  const firstName = contact.name.split(" ")[0] || contact.name;
  const sent = await sendMessage(
    "whatsapp",
    {
      address: contact.phoneE164,
      optedIn: contact.optedIn,
      optedOutAt: contact.optedOutAt,
    },
    {
      kind: "template",
      category: template.category === "MARKETING" ? "MARKETING" : "UTILITY",
      templateName: template.name,
      language: template.language,
      bodyParams: [firstName],
    },
    { orgId: contact.orgId }
  );
  if (!sent.ok) {
    return {
      ok: false,
      detail: sent.blockedByConsent
        ? "Blocked by the consent gate (blockedByConsent) — contact has not opted in to marketing."
        : sent.error ?? "Send failed.",
    };
  }

  const parsed = campaignContentSchema.safeParse(template.content);
  const body = parsed.success
    ? parsed.data.body.replaceAll("{{1}}", firstName)
    : `Sent template "${template.name}"`;
  const conversation = await ensureConversation(contact);
  await recordOutbound(conversation.id, contact.id, body, sent.providerMessageId);
  return {
    ok: true,
    detail: `Sent template "${template.name}" to ${contact.name}.`,
    replyText: body,
  };
}

async function addTagStep(
  contact: Contact,
  config: Record<string, unknown>
): Promise<StepResult> {
  const tagId = typeof config.tagId === "string" ? config.tagId : "";
  if (!tagId) return { ok: false, detail: "No tag selected." };

  const tag = await prisma.tag.findFirst({
    where: { id: tagId, orgId: contact.orgId },
  });
  if (!tag) return { ok: false, detail: "Tag not found in this workspace." };

  await prisma.contactTag.upsert({
    where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
    create: { contactId: contact.id, tagId: tag.id },
    update: {},
  });
  // Deliberately NOT calling fireTagAdded here: an automation that adds a tag
  // must never cascade into tag_added automations (infinite-loop guard).
  return { ok: true, detail: `Added tag "${tag.name}".` };
}

async function assignAgentStep(
  contact: Contact,
  config: Record<string, unknown>
): Promise<StepResult> {
  const userId = typeof config.userId === "string" ? config.userId : "";
  if (!userId) return { ok: false, detail: "No teammate selected." };

  const membership = await prisma.membership.findFirst({
    where: { orgId: contact.orgId, userId },
  });
  if (!membership) {
    return { ok: false, detail: "That teammate is no longer in this workspace." };
  }

  await prisma.$transaction([
    prisma.contact.update({
      where: { id: contact.id },
      data: { assignedToUserId: userId },
    }),
    prisma.conversation.updateMany({
      where: { orgId: contact.orgId, contactId: contact.id },
      data: { assignedToUserId: userId },
    }),
  ]);
  const label = membership.displayName ?? membership.email;
  return { ok: true, detail: `Assigned ${contact.name} to ${label}.` };
}

async function updateLeadStageStep(
  contact: Contact,
  config: Record<string, unknown>
): Promise<StepResult> {
  const stage = String(config.stage ?? "");
  const stages = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;
  const valid = stages.find((s) => s === stage);
  if (!valid) return { ok: false, detail: `Invalid lead stage "${stage}".` };

  await prisma.contact.update({
    where: { id: contact.id },
    data: { leadStage: valid },
  });
  return { ok: true, detail: `Lead stage set to ${valid}.` };
}

async function setConversationStatus(
  contact: Contact,
  ctx: RunContext,
  status: "resolved" | "handoff"
): Promise<StepResult> {
  const conversation = await prisma.conversation.findFirst({
    where: ctx.conversationId
      ? { id: ctx.conversationId, orgId: contact.orgId }
      : { orgId: contact.orgId, contactId: contact.id },
  });
  if (!conversation) {
    return { ok: true, detail: "No conversation for this contact — step skipped." };
  }
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status },
  });
  return {
    ok: true,
    detail:
      status === "resolved"
        ? "Conversation marked resolved."
        : "Conversation handed off to a human.",
  };
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Find-or-create the contact's thread — same upsert shape as inbound.ts. */
async function ensureConversation(contact: Contact) {
  return prisma.conversation.upsert({
    where: { orgId_contactId: { orgId: contact.orgId, contactId: contact.id } },
    create: { orgId: contact.orgId, contactId: contact.id },
    update: {},
  });
}

/** Thread the outbound message + keep inbox/CRM denorm fields fresh. */
async function recordOutbound(
  conversationId: string,
  contactId: string,
  body: string,
  metaMessageId?: string
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId,
        direction: "outbound",
        body,
        metaMessageId: metaMessageId ?? null,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastMessagePreview: body.slice(0, 140) },
    }),
    prisma.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: now },
    }),
  ]);
}

function logEntry(
  step: number,
  kind: string,
  ok: boolean,
  detail: string
): RunLogEntry {
  return { step, kind, ok, detail, at: new Date().toISOString() };
}

function outcome(
  runId: string,
  status: AutomationRunStatus,
  log: RunLogEntry[],
  replyText?: string
): RunOutcome {
  return {
    runId,
    status,
    log,
    replyText,
    sentMessage: log.some(
      (entry) =>
        entry.ok && (entry.kind === "send_message" || entry.kind === "send_template")
    ),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(log: RunLogEntry[]): Prisma.InputJsonValue {
  return log as unknown as Prisma.InputJsonValue;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Step failed unexpectedly.";
}
