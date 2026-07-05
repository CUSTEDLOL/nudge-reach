import { z } from "zod";
import { prisma } from "@/lib/db";
import { defineTool } from "@/modules/agent/tools/types";

export const captureBookingTool = defineTool({
  name: "capture_booking_request",
  description:
    "Record a booking / appointment / reservation request. ONLY call this AFTER you have confirmed the details with the customer — the name it's under and exactly when (date and time; party size if relevant). This notifies staff to confirm; it does not itself guarantee the slot, so after calling it, tell the customer the team will confirm shortly.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name the booking is under." },
      requested_for: {
        type: "string",
        description:
          "When, exactly as the customer said it (e.g. 'tomorrow 8pm', 'Sat 15th at 1pm').",
      },
      party_size: {
        type: "integer",
        description: "Number of people, if applicable.",
      },
      notes: { type: "string", description: "Any special requests." },
    },
    required: ["name", "requested_for"],
  },
  schema: z.object({
    name: z.string().trim().min(1),
    requested_for: z.string().trim().min(1),
    party_size: z.number().int().positive().max(500).optional(),
    notes: z.string().trim().optional(),
  }),
  write: true,
  async handler(ctx, input) {
    await prisma.bookingRequest.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        name: input.name,
        requestedFor: input.requested_for,
        partySize: input.party_size,
        notes: input.notes,
      },
    });
    if (ctx.contactName === ctx.contactPhone) {
      await prisma.contact.update({
        where: { id: ctx.contactId },
        data: { name: input.name },
      });
    }
    // Surface to a human to confirm the slot.
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
        body: `Booking request: ${input.name}, ${input.requested_for}${
          input.party_size ? `, party of ${input.party_size}` : ""
        }${input.notes ? ` (${input.notes})` : ""}`,
      },
    });
    return "Booking request recorded and staff notified to confirm.";
  },
});
