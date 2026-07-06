import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Public waitlist signup endpoint for the /waitlist landing page.
 * No auth (allow-listed in proxy-session PUBLIC_PATHS). Validates with zod,
 * normalizes the phone to E.164, and stores a WaitlistSignup row via Prisma.
 */
const schema = z.object({
  shopName: z.string().trim().min(1, "Business name is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  phone: z.string().trim().min(1, "Phone is required").max(20),
  // Free-text business category. The marketing site offers a broad set of
  // business types and the DB column is a plain string, so we validate length
  // only — this stays backward-compatible with the original retail verticals.
  vertical: z.string().trim().min(1, "Please choose a category").max(60),
  source: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  // Public endpoint → rate-limit by client IP (best-effort, per instance).
  // Prefer x-real-ip: the platform (Vercel) sets it to the true client and
  // overwrites any client-sent value, so it can't be spoofed to rotate past
  // the throttle the way the leftmost x-forwarded-for entry can.
  const ip =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rate = checkRateLimit(`waitlist:${ip}`, RATE_LIMITS.publicForm);
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

  try {
    await prisma.waitlistSignup.create({
      data: {
        shopName: parsed.data.shopName,
        city: parsed.data.city,
        phoneE164,
        vertical: parsed.data.vertical,
        source: parsed.data.source ?? "landing",
      },
    });
  } catch {
    // Don't leak DB errors; a signup failing shouldn't expose internals.
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
