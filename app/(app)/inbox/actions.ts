"use server";

import { revalidatePath } from "next/cache";
import type { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrgContext } from "@/lib/auth";
import { sendMessage } from "@/lib/messaging";
import { isWithinServiceWindow } from "@/lib/agent/window";
import { handleInboundMessage } from "@/lib/agent/inbound";
import { fireTagAdded } from "@/lib/automation/triggers";
import { campaignContentSchema } from "@/lib/campaign/schema";
import { firstName, toPreview } from "@/lib/inbox/format";
import { normalizePhoneE164 } from "@/lib/phone";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isSuggestTone, suggestReply } from "@/lib/ai/suggest-reply";

/**
 * Inbox mutations (spec §M2). Deliberately NOT role-gated — AGENT teammates
 * work the inbox. Everything is org-scoped through requireOrgContext().
 */

export interface ActionResult {
  ok: boolean;
  message: string;
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

/** Free-form session reply — only valid inside the 24h service window. */
export async function sendTextAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const { org } = await requireOrgContext();
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
      { orgId: org.id }
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
      { orgId: org.id }
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
 * Simulation-only tester: pretend the customer sent a message, routed through
 * the exact handler the live webhook uses (lib/agent/inbound.ts).
 */
export async function simulateInboundAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    if (env.SEND_MODE !== "simulation") {
      return { ok: false, message: "The tester only works in simulation mode." };
    }
    const { org } = await requireOrgContext();
    const rawPhone = String(formData.get("phone") ?? "").trim();
    const text = String(formData.get("text") ?? "").trim();
    if (!rawPhone || !text) {
      return { ok: false, message: "Enter a phone number and a message." };
    }
    // Users type local numbers; the inbound handler expects webhook-shaped
    // (country-code-included) input — normalize with the org's dial code.
    const phone = normalizePhoneE164(rawPhone, org.dialCode);
    if (!phone) {
      return { ok: false, message: "That phone number doesn't look right." };
    }

    // handleInboundMessage maintains the denormalized inbox-list fields
    // (lastMessageAt / preview / unread) itself — same path as the webhook.
    const result = await handleInboundMessage(org.id, phone, text);

    revalidateInbox(result.conversationId);

    if (result.optedOut) {
      return { ok: true, message: "Customer opted out (STOP) — no reply sent." };
    }
    if (result.skipped) {
      return {
        ok: true,
        message:
          result.skipped === "disabled"
            ? "Message received. The AI agent is off, so no auto-reply was sent."
            : "Message received. No AI agent is configured, so no auto-reply was sent.",
      };
    }
    if (result.handoff) {
      return { ok: true, message: "Message received — the agent handed off to a human." };
    }
    return { ok: true, message: "Message received — the agent replied." };
  } catch {
    return { ok: false, message: "The simulated message failed — try again." };
  }
}
