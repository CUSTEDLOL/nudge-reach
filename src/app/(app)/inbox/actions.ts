"use server";

import { revalidatePath } from "next/cache";
import type { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { requireOrgContext } from "@/modules/orgs/auth";
import { sendMessage } from "@/modules/messaging";
import { isWithinServiceWindow } from "@/modules/agent/window";
import { handleInboundMessage } from "@/modules/agent/inbound";
import { fireTagAdded } from "@/modules/automation/triggers";
import { campaignContentSchema } from "@/modules/campaign/schema";
import { firstName, toPreview } from "@/modules/inbox/format";
import { normalizePhoneE164 } from "@/lib/phone";
import { sandboxAddress } from "@/modules/messaging/sandbox";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isSuggestTone, suggestReply } from "@/modules/ai/suggest-reply";
import { recordContactEvent } from "@/modules/contacts/events";
import { summarizeConversation } from "@/modules/ai/summarize";
import { dispatchWebhook } from "@/modules/integrations/outbound-webhooks";
import { isRestrictedAcquisitionTrial } from "@/modules/trial/capabilities";
import {
  type TrialReplySummary,
  withTrialReplyReservation,
} from "@/modules/trial/replies";
import { trialSandboxAddress } from "@/modules/trial/test-inbox";

/**
 * Inbox mutations (spec §M2). Deliberately NOT role-gated — AGENT teammates
 * work the inbox. Everything is org-scoped through requireOrgContext().
 */

export interface ActionResult {
  ok: boolean;
  message: string;
  /** Set by the simulation tester so the caller can open the thread. */
  conversationId?: string;
  /** The tester's message landed but no AI reply was sent, and why. */
  skipped?: "no_profile" | "disabled" | "trial_limit";
  /** Present only for a restricted acquisition trial. */
  trial?: TrialReplySummary;
}

export interface SuggestActionResult extends ActionResult {
  /** The AI (or sample) draft — filled into the composer, never auto-sent. */
  draft?: string;
  sample?: boolean;
}

function revalidateInbox(conversationId?: string) {
  revalidatePath("/inbox");
  if (conversationId) revalidatePath(`/inbox/${conversationId}`);
}

async function findConversation(orgId: string, conversationId: string) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    include: { contact: true },
  });
}

async function paidInboxMutationBlocked(orgId: string) {
  return await isRestrictedAcquisitionTrial(orgId)
    ? { ok: false as const, message: "This action is available on paid plans." }
    : null;
}

/** Free-form session reply — only valid inside the 24h service window. */
export async function sendTextAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const conversationId = String(formData.get("conversationId") ?? "");
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return { ok: false, message: "Type a message first." };
    if (text.length > 4096) {
      return { ok: false, message: "That message is too long for WhatsApp (4096 characters max)." };
    }

    const conversation = await findConversation(org.id, conversationId);
    if (!conversation) return { ok: false, message: "Conversation not found." };

    // The 24h window is enforced in code, not just in the UI.
    if (!isWithinServiceWindow(conversation.lastInboundAt)) {
      return {
        ok: false,
        message:
          "The 24-hour window has closed — send an approved template instead.",
      };
    }

    const result = await sendMessage(
      "whatsapp",
      {
        address: conversation.contact.phoneE164,
        optedIn: conversation.contact.optedIn,
        optedOutAt: conversation.contact.optedOutAt,
      },
      { kind: "text", text },
      { orgId: org.id, whatsappAccountId: conversation.whatsappAccountId }
    );
    if (!result.ok) {
      return { ok: false, message: result.error ?? "The message didn't send — try again." };
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          body: text,
          metaMessageId: result.providerMessageId,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: toPreview(text),
          unreadCount: 0,
          // Replying to a resolved thread reopens it.
          ...(conversation.status === "resolved" ||
          conversation.status === "closed"
            ? { status: "open" }
            : {}),
        },
      }),
      prisma.contact.update({
        where: { id: conversation.contactId },
        data: { lastContactedAt: now },
      }),
    ]);

    revalidateInbox(conversation.id);
    return { ok: true, message: "Sent." };
  } catch {
    return { ok: false, message: "Something went wrong — try again." };
  }
}

/**
 * Approved-template send for conversations outside the 24h window. MARKETING
 * templates pass through the consent gate in lib/messaging — a blocked send
 * comes back as a friendly message, never a thrown error.
 */
export async function sendTemplateAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const conversationId = String(formData.get("conversationId") ?? "");
    const templateId = String(formData.get("templateId") ?? "");
    if (!templateId) return { ok: false, message: "Pick a template first." };

    const conversation = await findConversation(org.id, conversationId);
    if (!conversation) return { ok: false, message: "Conversation not found." };

    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        orgId: org.id,
        campaignId: null,
        metaStatus: "APPROVED",
      },
    });
    if (!template) {
      return { ok: false, message: "That template isn't approved (or was removed)." };
    }

    const name = firstName(conversation.contact.name);
    const result = await sendMessage(
      "whatsapp",
      {
        address: conversation.contact.phoneE164,
        optedIn: conversation.contact.optedIn,
        optedOutAt: conversation.contact.optedOutAt,
      },
      {
        kind: "template",
        category: template.category === "UTILITY" ? "UTILITY" : "MARKETING",
        templateName: template.name,
        language: template.language,
        bodyParams: [name],
      },
      { orgId: org.id, whatsappAccountId: conversation.whatsappAccountId }
    );

    if (result.blockedByConsent) {
      return {
        ok: false,
        message: `${conversation.contact.name} hasn't opted in to marketing messages, so this template can't be sent. Ask them to opt in first.`,
      };
    }
    if (!result.ok) {
      return { ok: false, message: result.error ?? "The template didn't send — try again." };
    }

    // Store the rendered body so the thread shows what the customer saw.
    const parsed = campaignContentSchema.safeParse(template.content);
    const body = parsed.success
      ? parsed.data.body.replaceAll("{{1}}", name)
      : `Sent template “${template.name}”`;

    const now = new Date();
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "outbound",
          body,
          metaMessageId: result.providerMessageId,
        },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: toPreview(body),
          unreadCount: 0,
        },
      }),
      prisma.contact.update({
        where: { id: conversation.contactId },
        data: { lastContactedAt: now },
      }),
    ]);

    revalidateInbox(conversation.id);
    return { ok: true, message: `Template “${template.name}” sent.` };
  } catch {
    return { ok: false, message: "Something went wrong — try again." };
  }
}

/** AI assist: returns a draft for the composer. Never sends anything. */
export async function suggestReplyAction(
  formData: FormData
): Promise<SuggestActionResult> {
  try {
    const { org } = await requireOrgContext();
    if (await isRestrictedAcquisitionTrial(org.id)) {
      return { ok: false, message: "This AI tool is available on paid plans." };
    }
    const conversationId = String(formData.get("conversationId") ?? "");
    const tone = String(formData.get("tone") ?? "friendly");
    if (!isSuggestTone(tone)) {
      return { ok: false, message: "Unknown tone." };
    }

    // AI cost protection: cap drafts per org per minute.
    const rate = checkRateLimit(`suggest:${org.id}`, RATE_LIMITS.aiSuggest);
    if (!rate.allowed) {
      return {
        ok: false,
        message: `Drafting a lot right now — try again in ${rate.retryAfterSeconds}s.`,
      };
    }

    const result = await suggestReply(org.id, conversationId, tone);
    if (!result.ok || !result.draft) {
      return { ok: false, message: result.error ?? "Couldn't draft a reply." };
    }
    return {
      ok: true,
      message: result.sample
        ? "Sample draft added (connect an Anthropic key for real AI drafts)."
        : "Draft ready — edit it before sending.",
      draft: result.draft,
      sample: result.sample,
    };
  } catch {
    return { ok: false, message: "Couldn't draft a reply — try again." };
  }
}

const CONVERSATION_STATUSES = ["open", "pending", "resolved"] as const;

export async function setConversationStatusAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const conversationId = String(formData.get("conversationId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!(CONVERSATION_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, message: "Unknown status." };
    }

    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, orgId: org.id },
      data: { status },
    });
    if (updated.count === 0) return { ok: false, message: "Conversation not found." };

    revalidateInbox(conversationId);
    return { ok: true, message: `Marked ${status}.` };
  } catch {
    return { ok: false, message: "Couldn't update the status — try again." };
  }
}

export async function assignConversationAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const conversationId = String(formData.get("conversationId") ?? "");
    const userId = String(formData.get("userId") ?? "");

    let assignedToUserId: string | null = null;
    let assigneeName = "";
    if (userId) {
      const member = await prisma.membership.findFirst({
        where: { orgId: org.id, userId },
      });
      if (!member) return { ok: false, message: "That teammate isn't in this workspace." };
      assignedToUserId = member.userId;
      assigneeName = member.displayName ?? member.email;
    }

    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, orgId: org.id },
      data: { assignedToUserId },
    });
    if (updated.count === 0) return { ok: false, message: "Conversation not found." };
    void dispatchWebhook(org.id, "conversation.assigned", {
      conversationId,
      assignedToUserId,
    });

    revalidateInbox(conversationId);
    return {
      ok: true,
      message: assignedToUserId ? `Assigned to ${assigneeName}.` : "Unassigned.",
    };
  } catch {
    return { ok: false, message: "Couldn't assign — try again." };
  }
}

const LEAD_STAGES: LeadStage[] = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

export async function setLeadStageAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const contactId = String(formData.get("contactId") ?? "");
    const conversationId = String(formData.get("conversationId") ?? "");
    const stage = String(formData.get("stage") ?? "") as LeadStage;
    if (!LEAD_STAGES.includes(stage)) {
      return { ok: false, message: "Unknown stage." };
    }

    const updated = await prisma.contact.updateMany({
      where: { id: contactId, orgId: org.id },
      data: { leadStage: stage },
    });
    if (updated.count === 0) return { ok: false, message: "Contact not found." };
    recordContactEvent(org.id, "lead_stage_changed", {
      contactId,
      props: { to: stage, source: "manual" },
    });

    revalidateInbox(conversationId || undefined);
    revalidatePath("/contacts");
    return { ok: true, message: `Stage set to ${stage.toLowerCase()}.` };
  } catch {
    return { ok: false, message: "Couldn't update the stage — try again." };
  }
}

export async function addContactTagAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const contactId = String(formData.get("contactId") ?? "");
    const conversationId = String(formData.get("conversationId") ?? "");
    const tagId = String(formData.get("tagId") ?? "");

    const [contact, tag] = await Promise.all([
      prisma.contact.findFirst({ where: { id: contactId, orgId: org.id } }),
      prisma.tag.findFirst({ where: { id: tagId, orgId: org.id } }),
    ]);
    if (!contact || !tag) return { ok: false, message: "Tag or contact not found." };

    await prisma.contactTag.createMany({
      data: [{ contactId: contact.id, tagId: tag.id }],
      skipDuplicates: true,
    });

    // Automation hook (M6) — a broken automation must never break tagging.
    try {
      await fireTagAdded(org.id, contact.id, tag.name);
    } catch {
      // swallowed by contract (lib/automation/triggers.ts)
    }

    revalidateInbox(conversationId || undefined);
    revalidatePath("/contacts");
    return { ok: true, message: `Tagged “${tag.name}”.` };
  } catch {
    return { ok: false, message: "Couldn't add the tag — try again." };
  }
}

export async function removeContactTagAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(org.id);
    if (blocked) return blocked;
    const contactId = String(formData.get("contactId") ?? "");
    const conversationId = String(formData.get("conversationId") ?? "");
    const tagId = String(formData.get("tagId") ?? "");

    await prisma.contactTag.deleteMany({
      where: {
        contactId,
        tagId,
        contact: { orgId: org.id },
        tag: { orgId: org.id },
      },
    });

    revalidateInbox(conversationId || undefined);
    revalidatePath("/contacts");
    return { ok: true, message: "Tag removed." };
  } catch {
    return { ok: false, message: "Couldn't remove the tag — try again." };
  }
}

export async function addNoteAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    const blocked = await paidInboxMutationBlocked(ctx.org.id);
    if (blocked) return blocked;
    const conversationId = String(formData.get("conversationId") ?? "");
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return { ok: false, message: "Write the note first." };
    if (body.length > 2000) {
      return { ok: false, message: "Keep notes under 2000 characters." };
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, orgId: ctx.org.id },
      select: { id: true, contactId: true },
    });
    if (!conversation) return { ok: false, message: "Conversation not found." };

    await prisma.note.create({
      data: {
        orgId: ctx.org.id,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        authorUserId: ctx.userId,
        authorName:
          ctx.membership.displayName ?? ctx.email.split("@")[0] ?? "Teammate",
        body,
      },
    });

    revalidateInbox(conversation.id);
    return { ok: true, message: "Note added." };
  } catch {
    return { ok: false, message: "Couldn't add the note — try again." };
  }
}

/**
 * "Try your AI": pretend the customer sent a message, routed through the
 * exact handler the live webhook uses (lib/agent/inbound.ts). Works in every
 * workspace. In a LIVE workspace the pretend customer gets a sandbox number
 * (+999…, unassignable), so the AI's reply is mocked and can never reach a
 * real phone — a client can try the AI before their number is connected.
 */
export async function simulateInboundAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
    const rawPhone = String(formData.get("phone") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    const restrictedTrial = await isRestrictedAcquisitionTrial(org.id);
    if (!text || (!restrictedTrial && !rawPhone)) {
      return { ok: false, message: "Enter a message first." };
    }
    if (restrictedTrial) {
      const rate = checkRateLimit(
        `trial-simulation:${org.id}`,
        RATE_LIMITS.outboundTest,
      );
      if (!rate.allowed) {
        return {
          ok: false,
          message: `Sending a lot right now — try again in ${rate.retryAfterSeconds}s.`,
        };
      }
    }
    // Users type local numbers; the inbound handler expects webhook-shaped
    // (country-code-included) input — normalize with the org's dial code.
    const phone = restrictedTrial
      ? trialSandboxAddress(org.id)
      : isSimulated(org)
        ? normalizePhoneE164(rawPhone, org.dialCode)
        : sandboxAddress(rawPhone);
    if (!phone) {
      return { ok: false, message: "That phone number doesn't look right." };
    }

    const outcome = await withTrialReplyReservation(org.id, () =>
      handleInboundMessage(org.id, phone, text)
    );
    if (outcome.kind === "blocked") {
      return {
        ok: false,
        message: outcome.status === "expired"
          ? "Your seven-day trial has ended. Book your free setup demo to continue."
          : "You've used all 15 test replies. Book your free setup demo to continue.",
        skipped: "trial_limit",
        ...(outcome.trial ? { trial: outcome.trial } : {}),
      };
    }

    const { result, trial } = outcome;
    const freshTrial = trial;
    if (result.generatedByAi && trial) {
      try {
        const acquisitionTrial = await prisma.acquisitionTrial.findUnique({
          where: { orgId: org.id },
          select: { id: true },
        });
        if (acquisitionTrial) {
          await prisma.acquisitionTrial.updateMany({
            where: { id: acquisitionTrial.id, firstReplyAt: null },
            data: { firstReplyAt: new Date() },
          });
        }
      } catch (error) {
        console.error("[trial] first reply milestone failed", error);
      }
    }

    revalidateInbox(result.conversationId);
    revalidatePath("/inbox/try");
    revalidatePath("/dashboard");

    const conversationId = result.conversationId;
    if (result.optedOut) {
      return { ok: true, message: "Customer opted out (STOP) — no reply sent.", conversationId };
    }
    if (result.skipped) {
      return {
        ok: true,
        message:
          result.skipped === "disabled"
            ? "Message received — your AI is switched off (AI Front Desk → Setup), so it didn't reply."
            : "Message received. No AI agent is configured, so no auto-reply was sent.",
        conversationId,
        skipped: result.skipped,
      };
    }
    if (result.aiFailed) {
      return {
        ok: true,
        message:
          "The AI couldn't answer just now, so the chat was handed to a person — exactly what a customer would get. Try again in a minute.",
        conversationId,
        ...(freshTrial ? { trial: freshTrial } : {}),
      };
    }
    if (result.handoff) {
      return {
        ok: true,
        message: "Message received — the agent handed off to a human.",
        conversationId,
        ...(freshTrial ? { trial: freshTrial } : {}),
      };
    }
    return {
      ok: true,
      message: "Message received — the agent replied.",
      conversationId,
      ...(freshTrial ? { trial: freshTrial } : {}),
    };
  } catch {
    return { ok: false, message: "The simulated message failed — try again." };
  }
}

export interface SummarizeActionResult extends ActionResult {
  summary?: string;
  sample?: boolean;
}

/** E8: AI summary of the thread, saved as an internal note. Any role. */
export async function summarizeConversationAction(
  formData: FormData
): Promise<SummarizeActionResult> {
  try {
    const { org } = await requireOrgContext();
    if (await isRestrictedAcquisitionTrial(org.id)) {
      return { ok: false, message: "This AI tool is available on paid plans." };
    }
    const conversationId = String(formData.get("conversationId") ?? "");
    const rate = checkRateLimit(`summarize:${org.id}`, RATE_LIMITS.aiSuggest);
    if (!rate.allowed) {
      return {
        ok: false,
        message: `Too many summaries at once — try again in ${rate.retryAfterSeconds}s.`,
      };
    }
    const r = await summarizeConversation(org.id, conversationId);
    if (!r.ok) return { ok: false, message: r.error ?? "Couldn't summarize." };
    revalidateInbox(conversationId);
    return {
      ok: true,
      message: r.sample
        ? "Sample summary added to notes (offline mode)."
        : "Summary added to internal notes.",
      summary: r.summary,
      sample: r.sample,
    };
  } catch {
    return { ok: false, message: "Couldn't summarize — try again." };
  }
}
