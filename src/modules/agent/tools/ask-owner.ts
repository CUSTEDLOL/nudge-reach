import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/modules/agent/tools/types";
import { askOwner } from "@/modules/knowledge/questions";
import { questionKey } from "@/modules/knowledge/normalize";
import type { DigestEntry } from "@/modules/knowledge/digest";

/**
 * Learn-on-the-job: when the customer asks something the knowledge base does
 * not answer, queue it for the owner and tell the customer we're checking.
 * Guard rail: if an active fact ALREADY covers the question (the model
 * misfired), return it as KNOWN so the agent answers instead of stalling.
 */

/** Pure: does an existing fact cover this question? Conservative — every
 *  substantial token of the normalized question must appear in the fact. */
export function findKnownFact(
  entries: DigestEntry[],
  question: string
): DigestEntry | null {
  const tokens = questionKey(question)
    .split(" ")
    .filter((t) => t.length >= 4);
  if (!tokens.length) return null;
  for (const e of entries) {
    const hay = `${e.fact} ${e.condition ?? ""}`.toLowerCase();
    if (tokens.every((t) => hay.includes(t))) return e;
  }
  return null;
}

export const askOwnerTool = defineTool({
  name: "ask_owner",
  description:
    "Use when the customer asks a factual question about the business that the business knowledge does not answer (a dish, a price, a policy, availability). The question is sent to the business owner; tell the customer you're checking with the team and will get back to them. If the knowledge base already covers it, this returns the KNOWN fact — answer with it instead.",
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The customer's question, rephrased as one clear sentence.",
      },
    },
    required: ["question"],
  },
  schema: z.object({ question: z.string().trim().min(5).max(300) }),
  write: true,
  async handler(ctx, input) {
    const entries = await prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.orgId, status: "active" },
      select: { category: true, fact: true, condition: true },
      take: 400,
    });
    const known = findKnownFact(entries, input.question);
    if (known) {
      return `KNOWN: ${known.fact}${
        known.condition ? ` (only: ${known.condition})` : ""
      }. Answer the customer with this now — do not say you are checking.`;
    }
    await askOwner(
      {
        orgId: ctx.orgId,
        conversationId: ctx.conversationId,
        contactId: ctx.contactId,
      },
      input.question
    );
    return "QUEUED: The owner has been asked. Tell the customer you're checking with the team and will get back to them shortly — do not promise an exact time.";
  },
});
