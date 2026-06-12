import { env } from "@/lib/env";
import type {
  ChannelDriver,
  MessagePayload,
  Recipient,
  SendResult,
} from "@/lib/messaging/types";

/**
 * Live driver: official WhatsApp Cloud API ONLY (rule 1) —
 * POST graph.facebook.com/<version>/<PHONE_NUMBER_ID>/messages.
 * The send payload shape is unit-tested via buildSendPayload.
 */

export function buildSendPayload(to: string, payload: MessagePayload) {
  const components: Array<Record<string, unknown>> = [];

  if (payload.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        { type: "image", image: { link: payload.headerImageUrl } },
      ],
    });
  }

  if (payload.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: payload.bodyParams.map((text) => ({ type: "text", text })),
    });
  }

  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: payload.templateName,
      language: { code: payload.language },
      ...(components.length > 0 ? { components } : {}),
    },
  };
}

export class WhatsappLiveDriver implements ChannelDriver {
  async send(
    recipient: Recipient,
    payload: MessagePayload
  ): Promise<SendResult> {
    if (!env.PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
      return {
        ok: false,
        error:
          "Live mode is not configured: PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing.",
      };
    }

    const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.PHONE_NUMBER_ID}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildSendPayload(recipient.address, payload)),
    });

    const body = (await res.json().catch(() => null)) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      return {
        ok: false,
        error: body?.error?.message ?? `Cloud API error (HTTP ${res.status})`,
      };
    }
    return { ok: true, providerMessageId: body?.messages?.[0]?.id };
  }
}
