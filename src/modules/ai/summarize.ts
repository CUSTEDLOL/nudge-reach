import { prisma } from "@/lib/db";
import { chat } from "@/lib/model-router";
import { recordSyntheticUsage } from "@/lib/model-router/usage";
import { env } from "@/lib/env";
import { buildHistory } from "@/modules/agent/reply";
import { crmConversationSummary } from "@/modules/crm/events";

/**
 * E8: AI conversation summaries. One click turns a long thread into a short
 * brief — what the customer wants, what was agreed, what's still open — saved
 * as an internal note (so it shows everywhere notes show, survives forever,
 * and rides the existing CRM conversation-summary sync). Keyless/simulation
 * returns a deterministic sample so the feature demos with zero keys
 * (invariant 4). Runs through the model-router doorway: BYO-LLM orgs pay
 * their own provider; usage is metered either way.
 */

const HISTORY_TURNS = 60;
const SUMMARY_AUTHOR = { authorUserId: "ai-agent", authorName: "AI Assistant" };

export interface SummaryResult {
  ok: boolean;
  summary?: string;
  /** True when the summary is a canned offline sample. */
  sample?: boolean;
  error?: string;
}

const SYSTEM = [
  "You summarize a WhatsApp conversation between a business and a customer for the business's internal team.",
  "Write 3-5 short plain-text lines, no markdown, no preamble:",
  "1) what the customer wants, 2) key facts agreed (times, amounts, names), 3) what is still open or promised next.",
  "Be specific; never invent details that are not in the transcript.",
].join(" ");

export async function summarizeConversation(
  orgId: string,
  conversationId: string
): Promise<SummaryResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, orgId },
    select: {
      contactId: true,
      contact: { select: { name: true, phoneE164: true } },
      messages: { orderBy: { createdAt: "desc" }, take: HISTORY_TURNS },
    },
  });
  if (!conversation) return { ok: false, error: "Conversation not found." };
  if (conversation.messages.length === 0) {
    return { ok: false, error: "Nothing to summarize yet." };
  }

  const history = buildHistory(conversation.messages.slice().reverse());
  let summary: string;
  let sample = false;

  if (!env.ANTHROPIC_API_KEY) {
    // Deterministic offline sample (invariant 4) — clearly labeled.
    const inbound = conversation.messages.filter((m) => m.direction === "inbound");
    const last = inbound[0]?.body ?? conversation.messages[0].body;
    summary = [
      `Sample summary (connect an AI key for real ones).`,
      `${conversation.contact.name} — ${conversation.messages.length} messages.`,
      `Latest from customer: "${last.slice(0, 120)}"`,
    ].join("\n");
    sample = true;
    recordSyntheticUsage(
      { orgId, conversationId, purpose: "summary" },
      history.map((h) => h.text).join("\n"),
      summary
    );
  } else {
    const transcript = history
      .map((h) => `${h.role === "user" ? "Customer" : "Business"}: ${h.text}`)
      .join("\n");
    summary = await chat({
      system: SYSTEM,
      messages: [{ role: "user", text: transcript.slice(0, 24_000) }],
      maxTokens: 300,
      attribution: { orgId, conversationId, purpose: "summary" },
    });
    if (!summary.trim()) return { ok: false, error: "The model returned nothing — try again." };
  }

  await prisma.note.create({
    data: {
      orgId,
      contactId: conversation.contactId,
      conversationId,
      ...SUMMARY_AUTHOR,
      body: `Chat summary:\n${summary}`,
    },
  });
  // One-way CRM sync (Zoho/Salesforce) — the hook was built waiting for this.
  void crmConversationSummary(
    orgId,
    conversationId,
    { phoneE164: conversation.contact.phoneE164 },
    summary
  );
  return { ok: true, summary, sample };
}
