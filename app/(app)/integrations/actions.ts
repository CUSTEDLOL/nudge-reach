"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import {
  getWhatsappAccount,
  getWhatsappCredentials,
} from "@/lib/whatsapp/accounts";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import {
  deliver,
  generateWebhookSecret,
  isWebhookEvent,
} from "@/lib/webhooks/dispatch";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface CreateApiKeyResult extends ActionResult {
  /** Full key — present ONLY on success, shown once, never stored. */
  key?: string;
}

/**
 * "Test connection": simulation reports OK (with the mocked state spelled
 * out); live mode pings Graph API `GET /{phone_number_id}` with the
 * decrypted token and reports what Meta says.
 */
export async function testWhatsappConnectionAction(): Promise<ActionResult> {
  const { org } = await requireOrgContext();
  try {
    const rate = checkRateLimit(`meta-test:${org.id}`, RATE_LIMITS.outboundTest);
    if (!rate.allowed) {
      return {
        ok: false,
        message: `Give Meta a breather — try again in ${rate.retryAfterSeconds}s.`,
      };
    }
    if (env.SEND_MODE === "simulation") {
      const account = await getWhatsappAccount(org.id);
      return {
        ok: true,
        message: account
          ? `Simulation mode: "${account.displayName}" is saved and everything is wired up. Sends stay mocked until SEND_MODE=live.`
          : "Simulation mode: connection OK — sends and approvals are mocked, no WhatsApp account needed.",
      };
    }

    const credentials = await getWhatsappCredentials(org.id);
    if (!credentials) {
      return {
        ok: false,
        message:
          "No WhatsApp account connected yet — add one under Settings → WhatsApp.",
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${credentials.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
        cache: "no-store",
      }
    );
    const body = (await response.json().catch(() => ({}))) as {
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        message: `Meta rejected the connection: ${
          body.error?.message ?? `HTTP ${response.status}`
        }`,
      };
    }
    return {
      ok: true,
      message: `Connected: ${body.verified_name ?? "your number"} (${
        body.display_phone_number ?? credentials.phoneNumberId
      })${body.quality_rating ? ` · quality ${body.quality_rating}` : ""}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't reach the Meta API.",
    };
  }
}

export async function createApiKeyAction(
  formData: FormData
): Promise<CreateApiKeyResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { ok: false, message: "Give the key a name (e.g. “Zapier”)." };
    }
    if (name.length > 60) {
      return { ok: false, message: "Keep the key name under 60 characters." };
    }

    const { key } = await createApiKey(ctx.org.id, name);
    recordAudit(ctx, "api_key.created", name);
    revalidatePath("/integrations");
    return {
      ok: true,
      message: "API key created — copy it now, it won't be shown again.",
      key,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't create the API key.",
    };
  }
}

export async function revokeApiKeyAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const id = String(formData.get("id") ?? "");
    const revoked = await revokeApiKey(ctx.org.id, id);
    if (!revoked) {
      return { ok: false, message: "That key was already revoked or gone." };
    }
    recordAudit(ctx, "api_key.revoked", id);

    revalidatePath("/integrations");
    return { ok: true, message: "API key revoked — it stops working immediately." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't revoke the API key.",
    };
  }
}

// ---------------------------------------------------------------------------
// Outbound webhooks (Zapier / Make / n8n / custom)
// ---------------------------------------------------------------------------

export interface CreateWebhookResult extends ActionResult {
  /** The signing secret — shown once on create so the integrator can store it. */
  secret?: string;
}

export async function createWebhookEndpointAction(
  formData: FormData
): Promise<CreateWebhookResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const url = String(formData.get("url") ?? "").trim();
    const events = formData.getAll("events").map(String).filter(isWebhookEvent);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, message: "Enter a valid URL (https://…)." };
    }
    if (parsed.protocol !== "https:") {
      return { ok: false, message: "Webhook URLs must use https://." };
    }
    if (events.length === 0) {
      return { ok: false, message: "Pick at least one event to send." };
    }

    const secret = generateWebhookSecret();
    await prisma.webhookEndpoint.create({
      data: { orgId: ctx.org.id, url, secret, events },
    });
    recordAudit(ctx, "webhook.created", url, events.join(", "));
    revalidatePath("/integrations");
    return {
      ok: true,
      message: "Webhook added — copy the signing secret now, it won't be shown again.",
      secret,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't add the webhook.",
    };
  }
}

export async function toggleWebhookEndpointAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("id") ?? "");
    const enabled = formData.get("enabled") === "true";
    await prisma.webhookEndpoint.updateMany({
      where: { id, orgId: ctx.org.id },
      data: { enabled },
    });
    revalidatePath("/integrations");
    return { ok: true, message: enabled ? "Webhook enabled." : "Webhook paused." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't update the webhook.",
    };
  }
}

export async function deleteWebhookEndpointAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const id = String(formData.get("id") ?? "");
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { url: true },
    });
    await prisma.webhookEndpoint.deleteMany({
      where: { id, orgId: ctx.org.id },
    });
    if (endpoint) recordAudit(ctx, "webhook.deleted", endpoint.url);
    revalidatePath("/integrations");
    return { ok: true, message: "Webhook removed." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't remove the webhook.",
    };
  }
}

/** Send a signed test event so an integrator can confirm wiring end to end. */
export async function testWebhookEndpointAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const rate = checkRateLimit(
      `webhook-test:${ctx.org.id}`,
      RATE_LIMITS.outboundTest
    );
    if (!rate.allowed) {
      return {
        ok: false,
        message: `Too many test pings — try again in ${rate.retryAfterSeconds}s.`,
      };
    }
    const id = String(formData.get("id") ?? "");
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, orgId: ctx.org.id },
    });
    if (!endpoint) return { ok: false, message: "That webhook no longer exists." };

    const result = await deliver(endpoint, "test.ping", {
      message: "This is a test event from Nudge.",
      orgId: ctx.org.id,
    });
    revalidatePath("/integrations");
    return result.ok
      ? { ok: true, message: `Test delivered — endpoint returned HTTP ${result.status}.` }
      : {
          ok: false,
          message: `Test failed${
            result.status ? ` (HTTP ${result.status})` : ""
          } — check the URL is reachable.`,
        };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't send the test event.",
    };
  }
}
