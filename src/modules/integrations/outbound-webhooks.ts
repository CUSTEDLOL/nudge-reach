import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * Outbound webhooks (spec §M8 integrations): the app POSTs signed JSON to an
 * org's configured endpoints when a subscribed event fires. This is the real
 * integration surface — Zapier, Make, n8n and custom backends all consume it.
 *
 * Signature: header `X-Nudge-Signature: sha256=<hex>` = HMAC-SHA256 of the raw
 * body using the endpoint secret. Receivers verify it exactly like Meta's
 * webhook (see lib/webhook/verify.ts) so integrators have one mental model.
 */

export const WEBHOOK_EVENTS = [
  { value: "message.received", label: "Inbound message received" },
  { value: "message.sent", label: "Message sent to a contact" },
  { value: "campaign.completed", label: "Campaign finished sending" },
  { value: "contact.created", label: "New contact created" },
  { value: "conversation.assigned", label: "Conversation assigned to an agent" },
  { value: "automation.run", label: "Automation executed" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["value"];

export function isWebhookEvent(value: string): value is WebhookEvent {
  return WEBHOOK_EVENTS.some((e) => e.value === value);
}

/** Sign a raw JSON body with an endpoint secret (HMAC-SHA256, hex). */
export function signWebhook(rawBody: string, secret: string): string {
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
}

/** A fresh random secret for a new endpoint. */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

const DELIVERY_TIMEOUT_MS = 8000;

/**
 * Fire an event to every enabled endpoint of an org subscribed to it.
 * Fire-and-forget by design: a slow or failing integration must never break
 * the primary action. Each attempt is logged to WebhookDelivery for the UI.
 */
export async function dispatchWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  let endpoints;
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: { orgId, enabled: true, events: { has: event } },
    });
  } catch (error) {
    console.error("[webhooks] endpoint lookup failed", error);
    return;
  }
  if (endpoints.length === 0) return;

  await Promise.all(
    endpoints.map((endpoint) => deliver(endpoint, event, data))
  );
}

/** A single signed delivery attempt with its own logging + timeout. */
export async function deliver(
  endpoint: { id: string; url: string; secret: string },
  event: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number | null }> {
  const body = JSON.stringify({
    event,
    createdAt: new Date().toISOString(),
    data,
  });
  const signature = signWebhook(body, endpoint.secret);

  let status: number | null = null;
  let ok = false;
  let error: string | null = null;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nudge-Event": event,
        "X-Nudge-Signature": signature,
        "User-Agent": "Nudge-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    status = res.status;
    ok = res.ok;
    if (!ok) error = `Endpoint returned HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : "Delivery failed";
  }

  try {
    await prisma.$transaction([
      prisma.webhookDelivery.create({
        data: { endpointId: endpoint.id, event, status, ok, error },
      }),
      prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { lastStatus: status, lastDeliveryAt: new Date() },
      }),
    ]);
  } catch (logErr) {
    console.error("[webhooks] delivery log failed", logErr);
  }

  return { ok, status };
}
