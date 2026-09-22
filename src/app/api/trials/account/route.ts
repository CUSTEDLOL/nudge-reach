import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  provisionTrialAccount,
  type TrialAccountResult,
} from "@/modules/trial/account";
import { readTrialResumeToken } from "@/modules/trial/resume-cookie";

const ACCOUNT_CONFLICT =
  "This trial cannot create a new account. Sign in or restart with a different email.";
const ACCOUNT_UNAVAILABLE =
  "Account creation is temporarily unavailable. Please try again.";

export async function POST(request: Request) {
  const ip = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const rate = checkRateLimit(`trial-account:${ip}`, RATE_LIMITS.publicForm);

  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  let result: TrialAccountResult;
  try {
    result = await provisionTrialAccount(raw, readTrialResumeToken(request));
  } catch {
    result = { ok: false, code: "unavailable" };
  }

  if (result.ok) return NextResponse.json({ ok: true });
  if (result.code === "invalid" || result.code === "existing_account") {
    return NextResponse.json(
      { ok: false, error: ACCOUNT_CONFLICT },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { ok: false, error: ACCOUNT_UNAVAILABLE },
    { status: 503 },
  );
}
