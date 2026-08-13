import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/modules/agent/tools/types";
import { createPaymentLink } from "@/modules/payments";

/**
 * The collect-money action: creates a secure payment link (Razorpay in live,
 * simulation link otherwise) and hands it to the agent to include in its
 * reply. Amounts come from the business's own knowledge/prices and must be
 * confirmed with the customer first — the prompt enforces that; this tool
 * enforces bounds and the flagship plan gate (inside createPaymentLink).
 */
export const sendPaymentLinkTool = defineTool({
  name: "send_payment_link",
  description:
    "Create a secure payment link for this customer (deposit, advance, or bill). ONLY call this AFTER confirming the exact amount and what it's for with the customer — never invent an amount; use the business's stated prices. The link returned MUST be included verbatim in your reply.",
  inputSchema: {
    type: "object",
    properties: {
      amount: {
        type: "number",
        description:
          "Amount in the business's currency (e.g. 500 for ₹500). Major units, not paise.",
      },
      purpose: {
        type: "string",
        description:
          "What the payment is for, shown on the payment page (e.g. 'Booking deposit — Saturday 7 PM').",
      },
      method: {
        type: "string",
        enum: ["standard", "usdc"],
        description:
          "Payment method. Use \"usdc\" ONLY when the customer is paying from another country or explicitly asks to pay in crypto/stablecoin — it collects USDC on-chain, and the amount you pass is in USD. Omit (or use \"standard\") for normal card/UPI payment in the business's own currency.",
      },
    },
    required: ["amount", "purpose"],
  },
  schema: z.object({
    amount: z.number().positive().finite(),
    purpose: z.string().trim().min(3).max(200),
    method: z.enum(["standard", "usdc"]).optional(),
  }),
  write: true,
  async handler(ctx, input) {
    const amountMinor = Math.round(input.amount * 100);
    const outcome = await createPaymentLink(ctx.orgId, {
      contactId: ctx.contactId,
      conversationId: ctx.conversationId,
      amountMinor,
      purpose: input.purpose,
      rail: input.method === "usdc" ? "usdc" : "fiat",
    });

    if (outcome.status === "invalid") {
      return `Could not create the link: ${outcome.reason} Re-check the amount with the customer and try again.`;
    }
    if (outcome.status === "not_allowed") {
      // Recoverable: agent apologizes and offers staff follow-up instead.
      return `Payments can't be collected right now (${outcome.reason}). Tell the customer the team will share payment details shortly, and do NOT promise a link.`;
    }

    await prisma.note.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        authorUserId: "ai-agent",
        authorName: "AI Assistant",
        body: `Payment link sent: ${outcome.amountLabel} — ${input.purpose} (${outcome.shortUrl})`,
      },
    });

    return `Payment link created for ${outcome.amountLabel} (${input.purpose}): ${outcome.shortUrl} — include this exact link in your reply and tell the customer what it's for. They'll get a confirmation once it's paid.`;
  },
});
