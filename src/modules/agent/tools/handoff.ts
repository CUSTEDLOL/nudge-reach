import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/modules/agent/tools/types";

export const HANDOFF_TOOL_NAME = "handoff_to_human";

export const handoffTool = defineTool({
  name: HANDOFF_TOOL_NAME,
  description:
    "Escalate this chat to a human teammate. Use when the customer is upset, explicitly asks for a person, wants something outside what you can help with, or you are unsure. After calling this, tell the customer a team member will follow up shortly.",
  inputSchema: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "One short line on why a human is needed.",
      },
    },
    required: [],
  },
  schema: z.object({ reason: z.string().trim().optional() }),
  write: true,
  async handler(ctx, input) {
    await prisma.conversation.update({
      where: { id: ctx.conversationId },
      data: { status: "handoff" },
    });
    await prisma.note.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        authorUserId: "ai-agent",
        authorName: "AI Assistant",
        body: `Handed off to a human${input.reason ? `: ${input.reason}` : ""}.`,
      },
    });
    return "A team member has been notified and will take over this chat.";
  },
});
