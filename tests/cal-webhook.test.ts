import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseCalBooking,
  verifyCalSignature,
} from "@/modules/marketing/cal-webhook";

const SECRET = "cal-webhook-secret";

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

const longValue = "a".repeat(240);
const bookingPayload = {
  triggerEvent: "BOOKING_CREATED",
  createdAt: "2026-09-15T08:00:00.000Z",
  payload: {
    uid: "booking-uid-123",
    type: "request-your-free-demo",
    startTime: "2026-09-20T09:30:00.000Z",
    attendees: [
      {
        name: "Dr Priya Rao",
        email: "priya@example.com",
        phoneNumber: "+91 98765 43210",
        timeZone: "Asia/Kolkata",
      },
    ],
    metadata: {
      landingPath: `/industries/clinics/${longValue}`,
      referrer: `https://www.google.com/${longValue}`,
      utm_source: longValue,
      utm_medium: "organic",
      utm_campaign: "clinic-search",
      gaClientId: "12345.67890",
      videoCallUrl: "https://meet.example/private-room",
      undeclared: { patientAnswer: "private" },
    },
    additionalNotes: "Private consultation notes",
    videoCallData: { url: "https://meet.example/private-room" },
    attendeeIcsContent: "BEGIN:VCALENDAR\nPRIVATE ATTENDEE DATA",
    organizerIcsContent: "BEGIN:VCALENDAR\nPRIVATE ORGANIZER DATA",
    unexpected: { private: "must not survive" },
  },
};

type BookingFixture = typeof bookingPayload;
type MutateBooking = (booking: BookingFixture) => void;

const overlongDeclaredFields: Array<[string, MutateBooking]> = [
  [
    "event type",
    (booking) => {
      booking.payload.type = "x".repeat(129);
    },
  ],
  [
    "attendee name",
    (booking) => {
      booking.payload.attendees[0].name = "n".repeat(201);
    },
  ],
  [
    "attendee email",
    (booking) => {
      booking.payload.attendees[0].email = `${"a".repeat(243)}@example.com`;
    },
  ],
  [
    "attendee phone",
    (booking) => {
      booking.payload.attendees[0].phoneNumber = "1".repeat(65);
    },
  ],
  ...([
    "landingPath",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "gaClientId",
  ] as const).map<[string, MutateBooking]>((field) => [
    `metadata ${field}`,
    (booking) => {
      booking.payload.metadata[field] = "m".repeat(513);
    },
  ]),
];

describe("verifyCalSignature", () => {
  it("accepts the HMAC-SHA256 hex signature for the exact raw body", () => {
    const body = JSON.stringify(bookingPayload);
    expect(verifyCalSignature(body, sign(body), SECRET)).toBe(true);
  });

  it.each([
    ["missing signature", null, SECRET, JSON.stringify(bookingPayload)],
    ["empty signature", "", SECRET, JSON.stringify(bookingPayload)],
    ["malformed signature", "not-hex", SECRET, JSON.stringify(bookingPayload)],
    ["short signature", "ab12", SECRET, JSON.stringify(bookingPayload)],
    ["missing secret", sign(JSON.stringify(bookingPayload)), "", JSON.stringify(bookingPayload)],
    ["wrong secret", sign(JSON.stringify(bookingPayload)), "wrong", JSON.stringify(bookingPayload)],
    ["tampered body", sign(JSON.stringify(bookingPayload)), SECRET, JSON.stringify({ ...bookingPayload, createdAt: "changed" })],
  ])("rejects %s without throwing", (_name, signature, secret, body) => {
    expect(() => verifyCalSignature(body, signature, secret)).not.toThrow();
    expect(verifyCalSignature(body, signature, secret)).toBe(false);
  });
});

describe("parseCalBooking", () => {
  it("returns only the declared booking and attribution fields", () => {
    const parsed = parseCalBooking(JSON.stringify(bookingPayload));

    expect(parsed).toEqual({
      calUid: "booking-uid-123",
      attendeeName: "Dr Priya Rao",
      attendeeEmail: "priya@example.com",
      attendeePhoneE164: "+919876543210",
      eventType: "request-your-free-demo",
      startTime: new Date("2026-09-20T09:30:00.000Z"),
      attribution: {
        landingPath: `/industries/clinics/${longValue}`.slice(0, 200),
        referrer: `https://www.google.com/${longValue}`.slice(0, 200),
        utmSource: longValue.slice(0, 200),
        utmMedium: "organic",
        utmCampaign: "clinic-search",
        gaClientId: "12345.67890",
      },
    });

    const serialized = JSON.stringify(parsed);
    for (const sensitive of [
      "additionalNotes",
      "Private consultation notes",
      "videoCallUrl",
      "private-room",
      "attendeeIcsContent",
      "organizerIcsContent",
      "VCALENDAR",
      "unexpected",
      "patientAnswer",
    ]) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it.each([
    ["malformed", "12345.67890.123"],
    ["whitespace-padded", " 12345.67890 "],
    ["email-shaped", "person@example.com"],
    ["name-shaped", "Dr Priya Rao"],
    ["phone-shaped", "+919876543210"],
  ])("drops a %s GA client ID at signed Cal ingress", (_kind, gaClientId) => {
    const booking = structuredClone(bookingPayload);
    booking.payload.metadata.gaClientId = gaClientId;

    const parsed = parseCalBooking(JSON.stringify(booking));

    expect(parsed?.attribution).not.toHaveProperty("gaClientId");
  });

  it("returns null for events other than the configured booking event", () => {
    expect(
      parseCalBooking(
        JSON.stringify({ ...bookingPayload, triggerEvent: "BOOKING_CANCELLED" })
      )
    ).toBeNull();
  });

  it("returns null for a different Cal event-type slug", () => {
    expect(
      parseCalBooking(
        JSON.stringify({
          triggerEvent: "BOOKING_CREATED",
          payload: { type: "60min", unrelated: "not our event shape" },
        })
      )
    ).toBeNull();
  });

  it.each(overlongDeclaredFields)(
    "rejects an overlong %s at the parser boundary",
    (_name, mutate) => {
      const booking = structuredClone(bookingPayload);
      mutate(booking);

      expect(() => parseCalBooking(JSON.stringify(booking))).toThrow();
    }
  );

  it("rejects more than ten attendees at the parser boundary", () => {
    const booking = structuredClone(bookingPayload);
    booking.payload.attendees = Array.from({ length: 11 }, () => ({
      ...booking.payload.attendees[0],
    }));

    expect(() => parseCalBooking(JSON.stringify(booking))).toThrow();
  });

  it("throws for invalid JSON or an invalid booking schema", () => {
    expect(() => parseCalBooking("{broken")).toThrow();
    expect(() =>
      parseCalBooking(
        JSON.stringify({
          triggerEvent: "BOOKING_CREATED",
          payload: {
            uid: "booking-uid-123",
            type: "request-your-free-demo",
            startTime: "not-a-date",
            attendees: [],
          },
        })
      )
    ).toThrow();
  });
});
