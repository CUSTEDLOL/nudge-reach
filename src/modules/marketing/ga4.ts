import "server-only";

import { env } from "@/lib/env";
import { isGaClientId } from "./ga-client-id";

export const GA4_LEAD_EVENT_NAMES = [
  "qualify_lead",
  "disqualify_lead",
  "close_convert_lead",
] as const;
export type Ga4LeadEventName = (typeof GA4_LEAD_EVENT_NAMES)[number];

export type Ga4LeadEventResult = "sent" | "skipped" | "failed";

const GA4_MEASUREMENT_PROTOCOL_URL =
  "https://www.google-analytics.com/mp/collect";
const REQUEST_TIMEOUT_MS = 5_000;
const OPAQUE_LEAD_ID = /^[A-Za-z0-9_-]{1,128}$/;

function isGa4LeadEventName(value: string): value is Ga4LeadEventName {
  return (GA4_LEAD_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Send one offline lead-quality event correlated to an existing GA web client.
 * The payload excludes direct contact, patient, appointment, Cal, and landing
 * fields. Its GA client ID is pseudonymous and its internal lead ID is opaque.
 */
export async function sendGa4LeadEvent({
  name,
  clientId,
  leadId,
}: {
  name: Ga4LeadEventName;
  clientId: string | null;
  leadId: string;
}): Promise<Ga4LeadEventResult> {
  const measurementId = env.GA4_MEASUREMENT_ID;
  const apiSecret = env.GA4_API_SECRET;
  if (
    env.NEXT_PUBLIC_MARKETING_ATTRIBUTION_ENABLED !== "true" ||
    !measurementId ||
    !apiSecret ||
    !isGaClientId(clientId) ||
    !isGa4LeadEventName(name) ||
    !OPAQUE_LEAD_ID.test(leadId)
  ) {
    return "skipped";
  }

  const url = new URL(GA4_MEASUREMENT_PROTOCOL_URL);
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        events: [{ name, params: { lead_id: `booking:${leadId}` } }],
      }),
      signal: controller.signal,
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timeout);
  }
}
