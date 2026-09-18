import { z } from "zod";
import { prisma } from "@/lib/db";
import { crmBookingCreated } from "@/modules/crm/events";
import { recordContactEvent } from "@/modules/contacts/events";
import { defineTool } from "@/modules/agent/tools/types";
import { bookAppointment, type CalendarSlot } from "@/modules/calendar";
import { fireBookingCreated } from "@/modules/automation/triggers";
import { formatInTimezone } from "@/lib/timezone";

export const captureBookingTool = defineTool({
  name: "capture_booking_request",
  description:
    "Record and, where possible, BOOK an appointment / reservation. ONLY call this AFTER confirming the details with the customer — the name it's under and exactly when (date and time; party size if relevant). If a calendar is connected the slot is checked and booked immediately; otherwise staff are notified to confirm. If the slot comes back taken, offer the alternatives returned and ask the customer to pick one.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Name the booking is under." },
      requested_for: {
        type: "string",
        description:
          "When, exactly as the customer said it (e.g. 'tomorrow 8pm', 'Sat at 1pm', '2026-07-10T13:00').",
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
    const partyLabel = input.party_size ? `, party of ${input.party_size}` : "";
    const summary = `Booking: ${input.name}${partyLabel}`;
    const channel = ctx.channel === "voice" ? "phone" : "WhatsApp";
    const description = [`Booked via ${channel} for ${ctx.contactPhone}.`, input.notes]
      .filter(Boolean)
      .join(" ");

    const outcome = await bookAppointment(ctx.orgId, {
      summary,
      requestedFor: input.requested_for,
      description,
    });

    // Shut then → record nothing; the agent explains and offers open times.
    if (outcome.status === "closed") {
      return `The business is closed at that time (that day's hours: ${outcome.hours}). Tell the customer, then offer these open times and ask them to pick one: ${formatAlternatives(
        outcome.alternatives,
        outcome.timezone
      )}. Then call this tool again with the chosen time.`;
    }

    // Slot was taken → record nothing; let the agent offer alternatives.
    if (outcome.status === "unavailable") {
      return `That time is taken. Offer these open slots and ask the customer to pick one: ${formatAlternatives(
        outcome.alternatives,
        outcome.timezone
      )}. Then call this tool again with the chosen time.`;
    }

    const booked = outcome.status === "booked";

    const booking = await prisma.bookingRequest.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        name: input.name,
        requestedFor: input.requested_for,
        partySize: input.party_size,
        notes: input.notes,
        status: booked ? "confirmed" : "pending",
        scheduledFor: booked ? outcome.scheduledFor : null,
        calendarEventId: booked ? outcome.eventId ?? null : null,
      },
    });
    if (ctx.externalSync !== false) {
      void crmBookingCreated(ctx.orgId, booking, { phoneE164: ctx.contactPhone });
    }
    recordContactEvent(ctx.orgId, "booking_status", {
      contactId: ctx.contactId,
      props: { status: booking.status, bookingRequestId: booking.id },
    });

    if (ctx.contactName === ctx.contactPhone) {
      await prisma.contact.update({
        where: { id: ctx.contactId },
        data: { name: input.name },
      });
    }

    await prisma.note.create({
      data: {
        orgId: ctx.orgId,
        contactId: ctx.contactId,
        conversationId: ctx.conversationId,
        authorUserId: "ai-agent",
        authorName: "AI Assistant",
        body: booked
          ? `Booking CONFIRMED in calendar: ${input.name}, ${formatWhen(
              outcome.scheduledFor,
              outcome.timezone
            )}${partyLabel}${input.notes ? ` (${input.notes})` : ""}`
          : `Booking request: ${input.name}, ${input.requested_for}${partyLabel}${
              input.notes ? ` (${input.notes})` : ""
            }`,
      },
    });

    if (booked) {
      // A confirmed booking with a real time drives the reminder / no-show
      // follow-ups (5.2). Fire-and-forget; never re-enters inbound.
      await fireBookingCreated(ctx.orgId, ctx.contactId, booking.id);
      // Only promise a reminder that will actually be sent: reminders go out
      // solely when the workspace has Follow-ups switched on.
      const reminders = await remindersOn(ctx.orgId);
      return `Booked and confirmed for ${formatWhen(
        outcome.scheduledFor,
        outcome.timezone
      )}. Tell the customer it's confirmed${
        reminders ? " and that they'll get a reminder" : ""
      }. Do not mention a reminder${reminders ? " beyond that" : ""}.`;
    }

    // No calendar connected, or the time couldn't be parsed → staff confirm.
    await prisma.conversation.update({
      where: { id: ctx.conversationId },
      data: { status: "handoff" },
    });
    return "Booking request recorded and staff notified to confirm.";
  },
});

async function remindersOn(orgId: string): Promise<boolean> {
  const cfg = await prisma.followUpConfig.findUnique({
    where: { orgId },
    select: { enabled: true, bookingReminders: true },
  });
  return Boolean(cfg?.enabled && cfg.bookingReminders);
}

function formatWhen(date: Date, timezone: string): string {
  return formatInTimezone(date, timezone);
}

function formatAlternatives(slots: CalendarSlot[], timezone: string): string {
  if (!slots.length) return "another time";
  return slots.map((s) => formatWhen(new Date(s.start), timezone)).join(" or ");
}
