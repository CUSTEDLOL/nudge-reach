import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordContactEvent } from "@/modules/contacts/events";
import { defineTool } from "@/modules/agent/tools/types";

export const captureLeadTool = defineTool({
  name: "capture_lead",
  description:
    "Record a qualified sales lead once you understand what the customer wants (their interest or need). Use this whenever there is buying intent — interested in a product, service, property, or wants a quote. Include their name if you know it.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Customer's name, if known." },
      interest: {
        type: "string",
        description: "What they want or need, in one line.",
      },
      details: {
        type: "string",
        description:
          "Key specifics if the customer gave them, as short phrases separated by periods: budget, quantity or size, timing or date, urgency, and how close they are to deciding.",
      },
    },
    required: ["interest"],
  },
  schema: z.object({
    name: z.string().trim().min(1).optional(),
    interest: z.string().trim().min(1),
    details: z.string().trim().optional(),
  }),
  write: true,
  async handler(ctx, input) {
    const knownName =
      input.name && ctx.contactName === ctx.contactPhone ? input.name : undefined;
    await prisma.contact.update({
      where: { id: ctx.contactId },
      data: { leadStage: "QUALIFIED", ...(knownName ? { name: knownName } : {}) },
    });
    recordContactEvent(ctx.orgId, "lead_stage_changed", {
      contactId: ctx.contactId,
      props: { to: "QUALIFIED", source: "agent" },
    });
    const interest = input.interest.trim().replace(/[.。]\s*$/, "");
    const detail = input.details?.trim();
    await prisma.note.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        authorUserId: "ai-agent",
        authorName: "AI Assistant",
        body: detail ? `${interest}. ${detail}` : interest,
      },
    });
    return "Lead captured and marked qualified for the sales team.";
  },
});
