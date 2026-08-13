import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * One-click guest sandbox: signs the visitor in anonymously and adds them as
 * an AGENT member of the pre-seeded shared demo workspace, then lands them on
 * the dashboard. No credentials, no auth-flow changes, and no heavy work in
 * the request path — the demo org is provisioned once via
 * `scripts/seed-demo-org.ts` (ownerUserId below), not per visitor.
 * Requires "Allow anonymous sign-ins" in Supabase.
 */
const DEMO_ORG_OWNER = "nudge-demo-template";

export async function GET(request: Request) {
  const supabase = await createClient();

  // Returning visitor with a session (anonymous or real) → their workspace.
  const { data: existing } = await supabase.auth.getClaims();
  if (existing?.claims) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = checkRateLimit(`demo:${ip}`, RATE_LIMITS.publicForm);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many demo sessions — try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const demoOrg = await prisma.org.findUnique({
    where: { ownerUserId: DEMO_ORG_OWNER },
    select: { id: true },
  });
  if (!demoOrg) {
    return NextResponse.json(
      { error: "Demo workspace is not provisioned yet. Please use /login." },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Guest demo is not enabled right now. Please use /login." },
      { status: 503 }
    );
  }

  await prisma.membership.upsert({
    where: {
      orgId_userId: { orgId: demoOrg.id, userId: data.user.id },
    },
    update: {},
    create: {
      orgId: demoOrg.id,
      userId: data.user.id,
      email: "",
      displayName: "Guest",
      role: "AGENT",
    },
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
