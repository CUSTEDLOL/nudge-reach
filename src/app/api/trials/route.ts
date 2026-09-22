import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  createPendingTrial,
  TRIAL_RESUME_COOKIE,
  TRIAL_RESUME_COOKIE_MAX_AGE_SECONDS,
  TrialSignupConflictError,
  trialSignupSchema,
} from "@/modules/trial/signup";
import { readTrialResumeToken } from "@/modules/trial/resume-cookie";

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const rate = checkRateLimit(`trial-signup:${ip}`, RATE_LIMITS.publicForm);

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }

  const parsed = trialSignupSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Check your details.",
      },
      { status: 400 }
    );
  }

  try {
    const claim = await createPendingTrial(
      parsed.data,
      new Date(),
      readTrialResumeToken(request),
    );
    const response = NextResponse.json({ ok: true, claim });
    response.cookies.set(TRIAL_RESUME_COOKIE, claim.claimToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/trials",
      maxAge: TRIAL_RESUME_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    const duplicate = (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === "P2002"
    ) || error instanceof TrialSignupConflictError;

    if (!duplicate) {
      console.error("[trial-signup] create failed", error);
    }

    return NextResponse.json(
      {
        ok: false,
        error: duplicate
          ? "A trial already exists for that email or mobile. Sign in to resume it."
          : "Couldn't start the trial.",
      },
      { status: duplicate ? 409 : 500 }
    );
  }
}
