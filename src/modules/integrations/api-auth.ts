import type { Org } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPlan, PLANS } from "@/modules/billing/plans";
import { verifyApiKey, API_KEY_PREFIX } from "@/modules/integrations/api-keys";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * E1 (docs/plans/2026-09-04-enterprise-track.md): the single auth doorway for
 * the public /api/v1 routes. Bearer nk_live_… key → org, with the publicApi
 * plan flag and a per-key rate limit enforced here so route handlers stay
 * thin. Always JSON errors — an API must never redirect to /login.
 */

export const API_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

export type ApiAuthResult =
  | { ok: true; org: Org; apiKeyId: string }
  | { ok: false; response: Response };

export function apiError(status: number, message: string, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ error: { status, message } }), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export async function resolveApiKeyOrg(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, key] = header.split(" ");
  if (scheme !== "Bearer" || !key || !key.startsWith(API_KEY_PREFIX)) {
    return {
      ok: false,
      response: apiError(401, "Pass your API key as: Authorization: Bearer nk_live_…"),
    };
  }

  const apiKey = await verifyApiKey(key);
  if (!apiKey) {
    return { ok: false, response: apiError(401, "Unknown or revoked API key.") };
  }

  const rate = checkRateLimit(`api-v1:${apiKey.id}`, API_RATE_LIMIT);
  if (!rate.allowed) {
    return {
      ok: false,
      response: apiError(429, "Rate limit exceeded.", {
        "Retry-After": String(rate.retryAfterSeconds),
      }),
    };
  }

  const org = await prisma.org.findUnique({ where: { id: apiKey.orgId } });
  if (!org) {
    return { ok: false, response: apiError(401, "Unknown or revoked API key.") };
  }
  if (!getPlan(org.plan).limits.publicApi) {
    const lowest = PLANS.find((p) => !p.contactOnly && p.limits.publicApi);
    return {
      ok: false,
      response: apiError(
        403,
        `The API is available from the ${lowest?.name ?? "Growth"} plan. Upgrade in Settings → Billing.`
      ),
    };
  }

  return { ok: true, org, apiKeyId: apiKey.id };
}
