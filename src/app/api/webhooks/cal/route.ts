import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ingestCalBooking,
  parseCalBooking,
  verifyCalSignature,
} from "@/modules/marketing/cal-webhook";

const SUPPORTED_WEBHOOK_VERSIONS = new Set(["2021-10-20", "2026-07-27"]);

/**
 * Cal.com is an external server caller, so the route's trust boundary is the
 * HMAC over the exact request bytes rather than an application session.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = env.CAL_WEBHOOK_SECRET;

  if (
    !secret ||
    !verifyCalSignature(
      rawBody,
      request.headers.get("x-cal-signature-256"),
      secret
    )
  ) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const version = request.headers.get("x-cal-webhook-version");
  if (!version || !SUPPORTED_WEBHOOK_VERSIONS.has(version)) {
    return NextResponse.json(
      { error: "unsupported webhook version" },
      { status: 400 }
    );
  }

  let booking;
  try {
    booking = parseCalBooking(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (!booking) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  await ingestCalBooking(booking);
  return NextResponse.json({ ok: true });
}
