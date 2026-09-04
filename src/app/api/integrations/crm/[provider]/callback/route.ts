import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { providerFor, saveConnection } from "@/modules/crm/connections";
import { verifyState } from "@/modules/crm/oauth-state";

/** The provider sends the browser back here; the signed state names the org. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const verified = verifyState(state, env.TOKEN_ENCRYPTION_KEY ?? "");
  if (!code || !verified || verified.provider !== provider) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }
  const org = await prisma.org.findUnique({
    where: { id: verified.orgId },
    select: { id: true, simulated: true },
  });
  if (!org) return NextResponse.json({ error: "org missing" }, { status: 404 });
  const base = env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const meta: Record<string, string> = {};
  for (const [k, v] of url.searchParams) meta[k] = v;
  const p = providerFor(verified.provider, org);
  try {
    const tokens = await p.exchangeCode({
      code,
      redirectUri: `${base}/api/integrations/crm/${provider}/callback`,
      meta,
    });
    await saveConnection(org.id, verified.provider, tokens, p.key === "sim");
    return NextResponse.redirect(`${base}/integrations?crm=connected`, 307);
  } catch (e) {
    const reason = encodeURIComponent((e as Error).message.slice(0, 120));
    return NextResponse.redirect(`${base}/integrations?crm=error&reason=${reason}`, 307);
  }
}
