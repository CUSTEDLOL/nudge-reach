import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { chat } from "@/lib/model-router";
import { recordSyntheticUsage } from "@/lib/model-router/usage";
import { buildHistory } from "@/modules/agent/reply";
import { MAX_ACTIVE_RULES, renderRulesBlock } from "@/modules/agent/rules";
import { activeRules } from "@/modules/agent/rules-store";
import { CREDITS_EXHAUSTED_MESSAGE, CreditsExhaustedError } from "@/modules/billing/credits";
import { normalizeWhatsAppMarkdown } from "@/modules/inbox/format";
import { buildKnowledgeDigest } from "@/modules/knowledge/digest";
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

/**
 * The two retired `/agent/setup` boxes used to be rendered into this prompt —
 * `businessInfo` as "ADDITIONAL BUSINESS INFORMATION:" and `doNots` as an
 * "- Also avoid: …" line under RULES. Do not reinstate them.
 * `migrateProfileToRules` copies both into house rules and knowledge facts, so
 * rendering them here as well sends a migrated org the same content twice, and
 * leaves the stale original speaking for a rule the owner has since edited or
 * archived. `buildAgentSystemPrompt` dropped them at fe85add for the same
 * reason; this builder drafts for the same agent off the same profile row.
 * They stay on `SuggestGrounding` and in every Prisma select — this is "stop
 * rendering", not "stop storing".
 */

/**
 * Pure system-prompt builder (unit-tested).
 *
 * `rules` are the org's house rules and are rendered ABOVE the knowledge, for
 * the same reason as on the agent's own prompt: "always push the waitlist"
 * must outrank whatever the facts happen to say. Defaulted to none only so a
 * prompt can still be built for a workspace that has written none — the one
 * production caller, `suggestReply`, always loads them.
 */
export function buildSuggestSystemPrompt(
  grounding: SuggestGrounding,
  tone: SuggestTone,
  knowledgeDigest = "",
  rules: Array<{ instruction: string }> = []
): string {
  const digest = knowledgeDigest.trim();
  return [
    `You are drafting a WhatsApp reply that a human agent at "${grounding.businessName}" will review, edit and send. Draft the single best reply to the customer's latest message.`,
    "",
    // Empty for an org with no rules, and dropped by the `.filter(Boolean)`.
    renderRulesBlock(rules),
    "",
    // "your source of truth for facts", not "your only source of truth": the
    // old wording told the model to ignore anything outside the knowledge,
    // which is exactly what the house rules above it are.
    // With the legacy blob gone there is one section either way, so the three
    // nested ternaries this replaced are down to one branch.
    ...(digest
      ? [
          "BUSINESS KNOWLEDGE — your source of truth for facts (never invent details not stated here):",
          digest,
        ]
      : [
          "BUSINESS INFORMATION — your source of truth for facts (never invent details not stated here):",
          "(No details provided.)",
        ]),
    "",
    grounding.tone.trim() ? `HOUSE STYLE: ${grounding.tone.trim()}.` : "",
    `TONE FOR THIS DRAFT: ${TONE_INSTRUCTIONS[tone]}`,
    "",
    "RULES:",
    "- Keep it natural for WhatsApp: short sentences, no markdown, no headings.",
    "- Never invent prices, stock, hours or policies. If unsure, say the team will confirm.",
    // The retired `doNots` box used to add "- Also avoid: …" here. It is a
    // house rule now, rendered above — see the note on `SuggestGrounding`.
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
    const draft = cannedDraft(tone, contactFirst, grounding.businessName);
    recordSyntheticUsage(
      { orgId, conversationId, purpose: "suggest" },
      grounding.businessInfo,
      draft
    );
    return { ok: true, draft, sample: true };
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

  const [knowledgeEntries, rules] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where: { orgId, status: "active" },
      select: { category: true, fact: true, condition: true },
      orderBy: { createdAt: "asc" },
      take: 400,
    }),
    // `suggestReplyAction` refuses a restricted acquisition trial outright,
    // so the full allowance is the only reachable cap here.
    activeRules(orgId, MAX_ACTIVE_RULES.full),
  ]);

  try {
    const draft = await chat({
      system: buildSuggestSystemPrompt(
        grounding,
        tone,
        buildKnowledgeDigest(knowledgeEntries),
        rules
      ),
      messages: history,
      maxTokens: 300,
      attribution: { orgId, conversationId, purpose: "suggest" },
    });
    if (!draft) return { ok: false, error: "The model returned nothing — try again." };
    return { ok: true, draft: normalizeWhatsAppMarkdown(draft), sample: false };
  } catch (err) {
    if (err instanceof CreditsExhaustedError) return { ok: false, error: CREDITS_EXHAUSTED_MESSAGE };
    return { ok: false, error: "Couldn't draft a reply right now — try again." };
  }
}
