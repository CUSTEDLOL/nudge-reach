"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  getWhatsappAccount,
  getWhatsappCredentials,
} from "@/lib/whatsapp/accounts";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";

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
