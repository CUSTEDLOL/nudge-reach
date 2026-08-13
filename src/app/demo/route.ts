import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { seedDemoWorkspace } from "@/modules/demo/seed";
import { resolveOrgContext } from "@/modules/orgs/org";

/**
 * One-click judge/guest sandbox: signs the visitor in anonymously, provisions
 * their own fresh org (normal tenant isolation — nothing is shared), fills it
 * via the demo seeder, and lands them on the dashboard. No credentials, no
 * auth-flow changes. Requires "Allow anonymous sign-ins" in Supabase.
 */
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
      { error: "Too many demo workspaces — try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Guest demo is not enabled right now. Please use /login." },
      { status: 503 }
    );
  }

  const { org } = await resolveOrgContext(data.user.id);
  await prisma.org.update({
    where: { id: org.id },
    data: { name: "Kanchan Silks (Demo)" },
  });
  await seedDemoWorkspace(prisma, org.id);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
