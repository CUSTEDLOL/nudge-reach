import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ingestCalBooking,
  isCalSignatureFormat,
  parseCalBooking,
  verifyCalSignature,
} from "@/modules/marketing/cal-webhook";

const SUPPORTED_WEBHOOK_VERSIONS = new Set(["2021-10-20", "2026-07-27"]);
// Normal Cal booking payloads are small; cap buffering at 64 KiB.
const MAX_CAL_WEBHOOK_BODY_BYTES = 64 * 1024;

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return { ok: true as const, bytes: new Uint8Array() };

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CAL_WEBHOOK_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false as const };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true as const, bytes };
}

/**
 * Cal.com is an external server caller, so the route's trust boundary is the
 * HMAC over the exact request bytes rather than an application session.
 */
export async function POST(request: Request) {
  const secret = env.CAL_WEBHOOK_SECRET;
  const signature = request.headers.get("x-cal-signature-256");

  if (!secret || !isCalSignatureFormat(signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const body = await readLimitedBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  if (!verifyCalSignature(body.bytes, signature, secret)) {
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
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes);
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
