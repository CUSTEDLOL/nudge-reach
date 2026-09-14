import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhoneE164 } from "@/lib/phone";
import type { AttributionSnapshot } from "./analytics";

const MAX_ATTRIBUTION_LENGTH = 200;

const attendeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  phoneNumber: z.string().min(1).nullable().optional(),
});

const metadataSchema = z.object({
  landingPath: z.string().optional(),
  referrer: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  gaClientId: z.string().optional(),
});

const bookingSchema = z.object({
  triggerEvent: z.literal("BOOKING_CREATED"),
  payload: z.object({
    uid: z.string().min(1).max(128),
    type: z.string().min(1),
    startTime: z.iso.datetime({ offset: true }),
    attendees: z.array(attendeeSchema).min(1),
    metadata: metadataSchema.optional(),
  }),
});

export type ParsedCalBooking = {
  calUid: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhoneE164?: string;
  eventType: string;
  startTime: Date;
  attribution: Partial<AttributionSnapshot>;
};

/** Verify Cal.com's raw-body HMAC-SHA256 hex signature. */
export function verifyCalSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!secret || !signature || !/^[0-9a-fA-F]{64}$/.test(signature)) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  const provided = Buffer.from(signature, "hex");

  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}

function limited(value: string | undefined) {
  return value ? value.slice(0, MAX_ATTRIBUTION_LENGTH) : undefined;
}

/** Parse one declared Cal booking shape and discard every undeclared field. */
export function parseCalBooking(rawBody: string): ParsedCalBooking | null {
  const json: unknown = JSON.parse(rawBody);
  const envelope = z.object({ triggerEvent: z.string() }).parse(json);

  if (envelope.triggerEvent !== "BOOKING_CREATED") return null;

  const discriminator = z
    .object({ payload: z.object({ type: z.string().min(1) }) })
    .parse(json);
  const expectedEventType = env.CAL_EVENT_TYPE_SLUG ?? "30min";
  if (discriminator.payload.type !== expectedEventType) return null;

  const booking = bookingSchema.parse(json);

  const attendee = booking.payload.attendees[0];
  const metadata = booking.payload.metadata;
  const phone = attendee.phoneNumber
    ? normalizePhoneE164(attendee.phoneNumber)
    : null;

  return {
    calUid: booking.payload.uid,
    ...(attendee.name ? { attendeeName: attendee.name } : {}),
    ...(attendee.email ? { attendeeEmail: attendee.email } : {}),
    ...(phone ? { attendeePhoneE164: phone } : {}),
    eventType: booking.payload.type,
    startTime: new Date(booking.payload.startTime),
    attribution: {
      ...(limited(metadata?.landingPath)
        ? { landingPath: limited(metadata?.landingPath) }
        : {}),
      ...(limited(metadata?.referrer)
        ? { referrer: limited(metadata?.referrer) }
        : {}),
      ...(limited(metadata?.utm_source)
        ? { utmSource: limited(metadata?.utm_source) }
        : {}),
      ...(limited(metadata?.utm_medium)
        ? { utmMedium: limited(metadata?.utm_medium) }
        : {}),
      ...(limited(metadata?.utm_campaign)
        ? { utmCampaign: limited(metadata?.utm_campaign) }
        : {}),
      ...(limited(metadata?.gaClientId)
        ? { gaClientId: limited(metadata?.gaClientId) }
        : {}),
    },
  };
}

/** Atomically create or refresh a booking without changing first-touch data. */
export async function ingestCalBooking(input: ParsedCalBooking) {
  const mappedInput = {
    calUid: input.calUid,
    attendeeName: input.attendeeName,
    attendeeEmail: input.attendeeEmail,
    attendeePhoneE164: input.attendeePhoneE164,
    eventType: input.eventType,
    startTime: input.startTime,
    landingPath: input.attribution.landingPath,
    referrer: input.attribution.referrer,
    utmSource: input.attribution.utmSource,
    utmMedium: input.attribution.utmMedium,
    utmCampaign: input.attribution.utmCampaign,
    gaClientId: input.attribution.gaClientId,
  };

  return prisma.demoBooking.upsert({
    where: { calUid: input.calUid },
    create: mappedInput,
    update: {
      startTime: input.startTime,
      attendeeName: input.attendeeName,
      attendeeEmail: input.attendeeEmail,
      attendeePhoneE164: input.attendeePhoneE164,
    },
  });
}
