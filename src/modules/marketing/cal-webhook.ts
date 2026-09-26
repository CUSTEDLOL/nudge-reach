import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhoneE164 } from "@/lib/phone";
import type { AttributionSnapshot } from "./analytics";
import { isGaClientId } from "./ga-client-id";

const MAX_ATTRIBUTION_LENGTH = 200;
const CAL_SIGNATURE_PATTERN = /^[0-9a-fA-F]{64}$/;

// Conservative ingress bounds keep third-party text finite before it can reach
// normalization, truncation, logging, or persistence.
const MAX_TRIGGER_EVENT_LENGTH = 64;
const MAX_CAL_UID_LENGTH = 128;
const MAX_EVENT_TYPE_LENGTH = 128;
const MAX_START_TIME_LENGTH = 64;
const MAX_ATTENDEES = 10;
const MAX_ATTENDEE_NAME_LENGTH = 200;
const MAX_ATTENDEE_EMAIL_LENGTH = 254;
const MAX_ATTENDEE_PHONE_LENGTH = 64;
const MAX_METADATA_INPUT_LENGTH = 512;

const eventTypeSchema = z.string().min(1).max(MAX_EVENT_TYPE_LENGTH);
const metadataStringSchema = z.string().max(MAX_METADATA_INPUT_LENGTH);

const attendeeSchema = z.object({
  name: z.string().min(1).max(MAX_ATTENDEE_NAME_LENGTH).optional(),
  email: z
    .string()
    .max(MAX_ATTENDEE_EMAIL_LENGTH)
    .pipe(z.email())
    .optional(),
  phoneNumber: z
    .string()
    .min(1)
    .max(MAX_ATTENDEE_PHONE_LENGTH)
    .nullable()
    .optional(),
});

const metadataSchema = z.object({
  landingPath: metadataStringSchema.optional(),
  referrer: metadataStringSchema.optional(),
  utm_source: metadataStringSchema.optional(),
  utm_medium: metadataStringSchema.optional(),
  utm_campaign: metadataStringSchema.optional(),
  gaClientId: metadataStringSchema.optional(),
});

const bookingSchema = z.object({
  triggerEvent: z.literal("BOOKING_CREATED"),
  payload: z.object({
    uid: z.string().min(1).max(MAX_CAL_UID_LENGTH),
    type: eventTypeSchema,
    startTime: z
      .string()
      .max(MAX_START_TIME_LENGTH)
      .pipe(z.iso.datetime({ offset: true })),
    attendees: z.array(attendeeSchema).min(1).max(MAX_ATTENDEES),
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

export function isCalSignatureFormat(
  signature: string | null
): signature is string {
  return signature !== null && CAL_SIGNATURE_PATTERN.test(signature);
}

/** Verify Cal.com's raw-body HMAC-SHA256 hex signature. */
export function verifyCalSignature(
  rawBody: string | Uint8Array,
  signature: string | null,
  secret: string
): boolean {
  if (!secret || !isCalSignatureFormat(signature)) {
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
  const envelope = z
    .object({
      triggerEvent: z.string().max(MAX_TRIGGER_EVENT_LENGTH),
    })
    .parse(json);

  if (envelope.triggerEvent !== "BOOKING_CREATED") return null;

  const discriminator = z
    .object({ payload: z.object({ type: eventTypeSchema }) })
    .parse(json);
  const expectedEventType = env.CAL_EVENT_TYPE_SLUG ?? "request-your-free-demo";
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
      ...(isGaClientId(metadata?.gaClientId)
        ? { gaClientId: metadata.gaClientId }
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
