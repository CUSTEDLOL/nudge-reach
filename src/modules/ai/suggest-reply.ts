import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { chat } from "@/lib/model-router";
import { buildHistory } from "@/modules/agent/reply";
import { firstName } from "@/modules/inbox/format";
import { SUGGEST_TONES, type SuggestTone, isSuggestTone } from "@/modules/ai/tones";

// Re-export the client-safe tone constants so existing importers of this
// module keep working; client components should import from "@/modules/ai/tones".
export { SUGGEST_TONES, isSuggestTone };
export type { SuggestTone };

/**
 * AI-assisted reply drafts for the shared inbox (spec §M2). Drafts go into
 * the composer for a human to edit and send — NEVER auto-sent. Uses the
 * model-router `chat()` (cheap Haiku tier, rule 3). Without an
 * ANTHROPIC_API_KEY the module returns deterministic canned drafts labeled
 * "(sample)" so the feature stays demoable in any environment.
 */

const TONE_INSTRUCTIONS: Record<SuggestTone, string> = {
  professional:
    "Write in a courteous, professional tone. Clear and respectful, no slang, at most one emoji.",
  friendly:
    "Write in a warm, friendly tone, like a neighbourhood shopkeeper who knows the customer. One emoji is fine.",
  short:
    "Be as brief as possible — one or two short sentences, no filler, no emoji.",
  persuasive:
    "Be gently persuasive: highlight the benefit and end with a soft call to action. Never pushy.",
};

export interface SuggestGrounding {
  businessName: string;
  businessInfo: string;
  tone: string;
  doNots: string;
}

/** Pure system-prompt builder (unit-tested). */
export function buildSuggestSystemPrompt(
  grounding: SuggestGrounding,
  tone: SuggestTone
): string {
  return [
    `You are drafting a WhatsApp reply that a human agent at "${grounding.businessName}" will review, edit and send. Draft the single best reply to the customer's latest message.`,
    "",
    "BUSINESS INFORMATION (your only source of truth — never invent details not stated here):",
    grounding.businessInfo.trim() || "(No details provided.)",
    "",
    grounding.tone.trim() ? `HOUSE STYLE: ${grounding.tone.trim()}.` : "",
    `TONE FOR THIS DRAFT: ${TONE_INSTRUCTIONS[tone]}`,
    "",
    "RULES:",
    "- Keep it natural for WhatsApp: short sentences, no markdown, no headings.",
    "- Never invent prices, stock, hours or policies. If unsure, say the team will confirm.",
    grounding.doNots.trim() ? `- Also avoid: ${grounding.doNots.trim()}` : "",
    "- Output ONLY the reply text, nothing else.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Deterministic offline drafts, clearly labeled (unit-tested). */
export function cannedDraft(
  tone: SuggestTone,
  contactFirstName: string,
  businessName: string
): string {
  const drafts: Record<SuggestTone, string> = {
    professional: `Hello ${contactFirstName}, thank you for reaching out to ${businessName}. We've noted your message and will confirm the details shortly. Is there anything else we can help with? (sample)`,
    friendly: `Hi ${contactFirstName}! 😊 Thanks for messaging ${businessName} — happy to help with this. Give us a moment and we'll sort it out for you. (sample)`,
    short: `Hi ${contactFirstName}, on it — we'll confirm shortly. (sample)`,
    persuasive: `Hi ${contactFirstName}, great choice! Our regulars love this one and pieces move fast — shall we set one aside for you at ${businessName}? (sample)`,
  };
  return drafts[tone];
}

const HISTORY_TURNS = 10;

export interface SuggestResult {
  ok: boolean;
  draft?: string;
  /** True when the draft is a canned offline sample. */
  sample?: boolean;
  error?: string;
}

/** Org-scoped draft generation for one conversation. */
export async function suggestReply(
  orgId: string,
  conversationId: string,
  tone: SuggestTone
): Promise<SuggestResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    select: {
      contact: { select: { name: true } },
      org: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: HISTORY_TURNS },
    },
  });
  if (!conversation) return { ok: false, error: "Conversation not found." };

  const contactFirst = firstName(conversation.contact.name);

  const profile = await prisma.agentProfile.findUnique({ where: { orgId } });
  const grounding: SuggestGrounding = profile
    ? {
        businessName: profile.businessName,
        businessInfo: profile.businessInfo,
        tone: profile.tone,
        doNots: profile.doNots,
      }
    : {
        businessName: conversation.org.name,
        businessInfo: "",
        tone: "",
        doNots: "",
      };

  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: true,
      draft: cannedDraft(tone, contactFirst, grounding.businessName),
      sample: true,
    };
  }

  const history = buildHistory(
    conversation.messages.slice().reverse() // stored desc → chronological
  );
  if (history.length === 0) {
    return {
      ok: false,
      error: "No customer message to reply to yet.",
    };
  }

  try {
    const draft = await chat({
      system: buildSuggestSystemPrompt(grounding, tone),
      messages: history,
      maxTokens: 300,
    });
    if (!draft) return { ok: false, error: "The model returned nothing — try again." };
    return { ok: true, draft, sample: false };
  } catch {
    return { ok: false, error: "Couldn't draft a reply right now — try again." };
  }
}
