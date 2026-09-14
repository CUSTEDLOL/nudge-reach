import { env } from "@/lib/env";
import { isGaClientId } from "./ga-client-id";

export type Ga4LeadEventName =
  | "qualify_lead"
  | "disqualify_lead"
  | "close_convert_lead";

export type Ga4LeadEventResult = "sent" | "skipped" | "failed";

const GA4_MEASUREMENT_PROTOCOL_URL =
  "https://www.google-analytics.com/mp/collect";
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Send one offline lead-quality event correlated to an existing GA web client.
 * The payload deliberately contains no contact, appointment, or landing-page PII.
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
  if (!measurementId || !apiSecret || !isGaClientId(clientId)) {
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
