import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { providerFor } from "@/modules/crm/connections";
import { signState } from "@/modules/crm/oauth-state";
import type { CrmProviderKey } from "@/modules/crm/types";

const KEYS: CrmProviderKey[] = ["zoho", "salesforce"];

/** Begin the OAuth dance for a CRM: signed state → provider consent screen. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!KEYS.includes(provider as CrmProviderKey)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  const ctx = await requireOrgContext();
  requireRole(ctx, "ADMIN");
  const base = env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const redirectUri = `${base}/api/integrations/crm/${provider}/callback`;
  const state = signState(ctx.org.id, provider as CrmProviderKey, env.TOKEN_ENCRYPTION_KEY ?? "");
  const dc = new URL(request.url).searchParams.get("dc") ?? "in";
  const url = providerFor(provider as CrmProviderKey, ctx.org).authUrl({ state, redirectUri, dc });
  return NextResponse.redirect(url, 307);
}
