import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizePhoneE164 } from "@/lib/phone";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Public "Get Access" endpoint for the hero popup form.
 * No auth (allow-listed in proxy-session PUBLIC_PATHS). Validates with zod,
 * normalizes the phone to E.164, stores an AccessRequest row, then forwards
 * the lead to the founders' Google Sheet via LEADS_SHEET_WEBHOOK_URL (an Apps
 * Script web app). The row is the source of truth — a missing/failed webhook
 * never loses the lead.
 */

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().email("That email doesn't look right").max(120),
  phone: z.string().trim().min(1, "Phone is required").max(20),
  source: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rate = checkRateLimit(`access:${ip}`, RATE_LIMITS.publicForm);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests — please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check your details.";
    return NextResponse.json({ ok: false, error: first }, { status: 400 });
  }

  const phoneE164 = normalizePhoneE164(parsed.data.phone);
  if (!phoneE164) {
    return NextResponse.json(
      { ok: false, error: "That phone number doesn't look right." },
      { status: 400 }
    );
  }

  const { name, email } = parsed.data;
  const source = parsed.data.source ?? "hero";

  try {
    await prisma.accessRequest.create({
      data: { name, email, phoneE164, source },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  if (env.LEADS_SHEET_WEBHOOK_URL) {
    try {
      await fetch(env.LEADS_SHEET_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phoneE164, source }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Sheet forwarding is best-effort; the AccessRequest row already exists.
    }
  }

  return NextResponse.json({ ok: true });
}
