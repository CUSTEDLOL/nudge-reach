import crypto from "crypto";
import dns from "node:dns/promises";
import net from "node:net";
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

/** Is this resolved IP in a private / loopback / link-local / metadata range? */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127 || a === 10) return true; // this-host, loopback, private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::") return true; // loopback / unspecified
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // unique-local
  if (v6.startsWith("fe80")) return true; // link-local
  if (v6.startsWith("::ffff:")) return isBlockedIp(v6.slice(7)); // IPv4-mapped
  return false;
}

/**
 * Guard against SSRF: an org configures its own webhook URL, so treat it as
 * untrusted. Require https and confirm every resolved address is public before
 * we POST to it (and the fetch below refuses to follow redirects, so a 3xx to
 * an internal host can't slip past this check).
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (url.protocol !== "https:") throw new Error("Webhook URL must use https");
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  const addresses = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (addresses.length === 0) throw new Error("Webhook host did not resolve");
  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new Error("Webhook URL resolves to a private or reserved address");
    }
  }
}

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
    // SSRF guard: reject non-https / private-range hosts before we connect.
    await assertPublicHttpsUrl(endpoint.url);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nudge-Event": event,
        "X-Nudge-Signature": signature,
        "User-Agent": "Nudge-Webhooks/1.0",
      },
      body,
      redirect: "error", // never follow a 3xx to an internal host
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
