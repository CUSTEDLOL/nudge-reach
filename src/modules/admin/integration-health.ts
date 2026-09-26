/**
 * "Is every integration really working, right now?" — one authenticated,
 * read-only call per provider, made on the server where the production keys
 * live (Vercel keeps them write-only, so no laptop script can do this).
 *
 * Every check is free, changes nothing, never throws and never returns a
 * secret. OAuth apps (Google, Zoho, Salesforce) are checked by exchanging a
 * deliberately bogus authorization code: a provider answers "bad code" only
 * after it has accepted the client ID and secret, and "bad client" otherwise.
 */

export type HealthState = "ok" | "warn" | "fail" | "off";

export interface IntegrationHealth {
  key: string;
  name: string;
  state: HealthState;
  /** What is true right now, in one line. */
  summary: string;
  /** What to do about it, when anything. */
  fix?: string;
}

export type HealthEnv = Partial<Record<string, string>>;
type FetchFn = typeof fetch;

const TIMEOUT_MS = 8_000;
const BOGUS_CODE = "nudge-health-check-not-a-real-code";

function set(env: HealthEnv, key: string): string | null {
  const v = env[key]?.trim();
  return v ? v : null;
}

async function call(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit = {}
): Promise<{ status: number; body: unknown } | { error: string }> {
  try {
    const res = await fetchFn(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "network error" };
  }
}

const field = (body: unknown, key: string): unknown =>
  body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;

const form = (fields: Record<string, string>): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields),
});

export function appOriginFrom(env: HealthEnv): string {
  return (set(env, "NEXT_PUBLIC_APP_URL") ?? "https://nudgeagent.app").replace(/\/$/, "");
}

/** The callback Google must have on file. Mirrors calendar/google.ts. */
export function googleRedirectFor(env: HealthEnv): string {
  return set(env, "GOOGLE_OAUTH_REDIRECT_URI") ?? `${appOriginFrom(env)}/api/integrations/google/callback`;
}

// ---------------------------------------------------------------------------

async function checkAi(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "ai", name: "AI replies (Anthropic)" };
  const key = set(env, "ANTHROPIC_API_KEY");
  if (!key) {
    return { ...base, state: "fail", summary: "No Anthropic key: the AI cannot answer anyone.", fix: "Set ANTHROPIC_API_KEY in Vercel." };
  }
  const r = await call(f, "https://api.anthropic.com/v1/models?limit=1000", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  if ("error" in r) return { ...base, state: "fail", summary: `Anthropic unreachable: ${r.error}` };
  if (r.status === 401 || r.status === 403) {
    return { ...base, state: "fail", summary: "Anthropic rejected the key.", fix: "Create a new key in the Anthropic console and set ANTHROPIC_API_KEY." };
  }
  if (r.status !== 200) return { ...base, state: "fail", summary: `Anthropic answered HTTP ${r.status}.` };
  const model = set(env, "RUNTIME_MODEL") ?? "claude-sonnet-5";
  const data = field(r.body, "data");
  const ids = Array.isArray(data) ? data.map((m) => String(field(m, "id") ?? "")) : [];
  if (ids.length && !ids.includes(model)) {
    return { ...base, state: "warn", summary: `Key works, but "${model}" is not in this account's model list.`, fix: "Check RUNTIME_MODEL for a typo." };
  }
  return { ...base, state: "ok", summary: `Key valid; replies use ${model}.` };
}

async function checkVoice(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "voice", name: "Voice agent (ElevenLabs)" };
  const key = set(env, "ELEVENLABS_API_KEY");
  const agent = set(env, "ELEVENLABS_AGENT_ID");
  if (!key || !agent) return { ...base, state: "off", summary: "Not set up.", fix: "Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID (docs/VOICE.md)." };
  const headers = { "xi-api-key": key };
  const [a, s, p] = await Promise.all([
    call(f, `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agent)}`, { headers }),
    call(f, "https://api.elevenlabs.io/v1/convai/settings", { headers }),
    call(f, "https://api.elevenlabs.io/v1/convai/phone-numbers", { headers }),
  ]);
  if ("error" in a) return { ...base, state: "fail", summary: `ElevenLabs unreachable: ${a.error}` };
  if (a.status === 401) return { ...base, state: "fail", summary: "ElevenLabs rejected the API key." };
  if (a.status !== 200) return { ...base, state: "fail", summary: `Agent ${agent} not found (HTTP ${a.status}).`, fix: "Check ELEVENLABS_AGENT_ID." };
  const postCall = "error" in s ? null : field(field(s.body, "webhooks"), "post_call_webhook_id");
  const numbers = "error" in p || !Array.isArray(p.body) ? null : p.body.length;
  if (!postCall) {
    return { ...base, state: "fail", summary: "Agent works, but no post-call webhook is attached: calls would never reach the inbox.", fix: "Run the voice setup script (docs/VOICE.md)." };
  }
  if (!numbers) {
    return { ...base, state: "warn", summary: "Agent and webhooks work. No phone number is imported, so only browser test calls are possible.", fix: "Buy a number (Exotel or Twilio) and import it in ElevenLabs → Phone numbers." };
  }
  return { ...base, state: "ok", summary: `Agent, webhooks and ${numbers} phone number${numbers === 1 ? "" : "s"} ready.` };
}

async function checkGoogleCalendar(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "google-calendar", name: "Google Calendar" };
  const id = set(env, "GOOGLE_CLIENT_ID");
  const secret = set(env, "GOOGLE_CLIENT_SECRET");
  const redirect = googleRedirectFor(env);
  if (!id || !secret) {
    return { ...base, state: "off", summary: "Not set up: clients see \"isn't switched on yet\".", fix: `Create a Google OAuth client (Web), redirect URI ${redirect}; set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.` };
  }
  const r = await call(f, "https://oauth2.googleapis.com/token", form({
    code: BOGUS_CODE, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code",
  }));
  if ("error" in r) return { ...base, state: "fail", summary: `Google unreachable: ${r.error}` };
  const err = String(field(r.body, "error") ?? "");
  if (err === "invalid_grant") {
    return { ...base, state: "ok", summary: "Client ID and secret accepted by Google.", fix: `Make sure ${redirect} is listed under Authorized redirect URIs, and the app is published (Testing mode logs clients out after 7 days).` };
  }
  if (err === "redirect_uri_mismatch") {
    return { ...base, state: "fail", summary: "Google does not know this redirect URI.", fix: `Add ${redirect} under Authorized redirect URIs.` };
  }
  return { ...base, state: "fail", summary: `Google rejected the client (${err || `HTTP ${r.status}`}).`, fix: "Re-copy GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud → Credentials." };
}

async function checkPlaces(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "google-places", name: "\"Find my listing\" (Google Places)" };
  const key = set(env, "GOOGLE_MAPS_API_KEY");
  if (!key) return { ...base, state: "off", summary: "Not set up: the Google listing import is hidden.", fix: "Enable Places API (New) and set GOOGLE_MAPS_API_KEY." };
  // "IDs only" field mask: Google's free Text Search tier.
  const r = await call(f, "https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: "Marina Bay Sands Singapore", pageSize: 1 }),
  });
  if ("error" in r) return { ...base, state: "fail", summary: `Google unreachable: ${r.error}` };
  if (r.status === 200) return { ...base, state: "ok", summary: "Key valid; listing import works." };
  const message = String(field(field(r.body, "error"), "message") ?? `HTTP ${r.status}`);
  return { ...base, state: "fail", summary: `Google refused: ${message.slice(0, 140)}`, fix: "Enable \"Places API (New)\" for this key's project, and allow it in the key's API restrictions." };
}

async function checkRazorpayBilling(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "razorpay-billing", name: "Nudge's own billing (Razorpay)" };
  const id = set(env, "RAZORPAY_KEY_ID");
  const secret = set(env, "RAZORPAY_KEY_SECRET");
  if (!id || !secret) return { ...base, state: "off", summary: "Not set up: clients cannot pay Nudge by card or UPI in the app; invoice them outside.", fix: "Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET." };
  const r = await call(f, "https://api.razorpay.com/v1/payments?count=1", {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
  });
  if ("error" in r) return { ...base, state: "fail", summary: `Razorpay unreachable: ${r.error}` };
  if (r.status === 401) return { ...base, state: "fail", summary: "Razorpay rejected the key ID or secret." };
  if (r.status !== 200) return { ...base, state: "fail", summary: `Razorpay answered HTTP ${r.status}.` };
  if (!set(env, "RAZORPAY_WEBHOOK_SECRET")) {
    return { ...base, state: "fail", summary: "Keys work, but no webhook secret: payments would never be marked paid.", fix: `Add a webhook for ${appOriginFrom(env)}/api/webhooks/razorpay and set RAZORPAY_WEBHOOK_SECRET.` };
  }
  if (id.startsWith("rzp_test_")) return { ...base, state: "warn", summary: "Working, but these are TEST keys: no real money moves.", fix: "Switch to rzp_live_ keys after Razorpay activates the account." };
  return { ...base, state: "ok", summary: "Live keys and webhook secret in place." };
}

async function checkStripe(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "stripe", name: "Nudge's own billing, outside India (Stripe)" };
  const key = set(env, "STRIPE_SECRET_KEY");
  if (!key) return { ...base, state: "off", summary: "Not set up: non-INR clients are invoiced outside the app.", fix: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." };
  const r = await call(f, "https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
  if ("error" in r) return { ...base, state: "fail", summary: `Stripe unreachable: ${r.error}` };
  if (r.status !== 200) return { ...base, state: "fail", summary: `Stripe rejected the key (HTTP ${r.status}).` };
  if (!set(env, "STRIPE_WEBHOOK_SECRET")) return { ...base, state: "fail", summary: "Key works, but no webhook secret: paid checkouts would never activate a plan.", fix: `Add a webhook for ${appOriginFrom(env)}/api/webhooks/stripe (checkout.session.completed).` };
  if (key.startsWith("sk_test_")) return { ...base, state: "warn", summary: "Working, but this is a TEST key." };
  return { ...base, state: "ok", summary: "Live key and webhook secret in place." };
}

async function checkEmail(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "email", name: "Emails: owner setup links, invites (Resend)" };
  const key = set(env, "RESEND_API_KEY");
  const from = set(env, "EMAIL_FROM");
  if (!key || !from) return { ...base, state: "off", summary: "Not set up: you copy setup and invite links by hand from admin.", fix: "Verify your domain in Resend, then set RESEND_API_KEY and EMAIL_FROM (e.g. Nudge <hello@nudgeagent.app>)." };
  const domain = (from.match(/@([^>\s]+)/)?.[1] ?? "").toLowerCase();
  const r = await call(f, "https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
  if ("error" in r) return { ...base, state: "fail", summary: `Resend unreachable: ${r.error}` };
  if (r.status === 401 || r.status === 403) {
    // A "sending only" key cannot list domains but can still send.
    const restricted = String(field(r.body, "name") ?? "").includes("restricted");
    return restricted
      ? { ...base, state: "warn", summary: `Sending-only key: can't confirm that ${domain} is verified.`, fix: "Check the domain shows Verified in Resend." }
      : { ...base, state: "fail", summary: "Resend rejected the API key." };
  }
  const list = field(r.body, "data");
  const match = Array.isArray(list) ? list.find((d) => String(field(d, "name")).toLowerCase() === domain) : undefined;
  if (!match) return { ...base, state: "fail", summary: `${domain || "The EMAIL_FROM domain"} is not added in Resend: every email would be refused.`, fix: `Add and verify ${domain} in Resend → Domains.` };
  const status = String(field(match, "status"));
  if (status !== "verified") return { ...base, state: "fail", summary: `${domain} is "${status}" in Resend, not verified.`, fix: "Add the DNS records Resend shows, then press Verify." };
  return { ...base, state: "ok", summary: `Sending from ${from}; domain verified.` };
}

async function checkZoho(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "zoho", name: "Zoho CRM" };
  const id = set(env, "ZOHO_CLIENT_ID");
  const secret = set(env, "ZOHO_CLIENT_SECRET");
  const redirect = `${appOriginFrom(env)}/api/integrations/crm/zoho/callback`;
  if (!id || !secret) return { ...base, state: "off", summary: "Not set up: clients see \"Not switched on yet\".", fix: `Create a Server-based client at api-console.zoho.in, redirect ${redirect}; set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.` };
  const r = await call(f, "https://accounts.zoho.in/oauth/v2/token", form({
    grant_type: "authorization_code", client_id: id, client_secret: secret, redirect_uri: redirect, code: BOGUS_CODE,
  }));
  if ("error" in r) return { ...base, state: "fail", summary: `Zoho unreachable: ${r.error}` };
  const err = String(field(r.body, "error") ?? "");
  if (err === "invalid_code") return { ...base, state: "ok", summary: "Client accepted by Zoho (India data centre).", fix: `Clients on zoho.com or zoho.eu need multi-DC enabled on the client. Redirect: ${redirect}` };
  if (err === "invalid_redirect_uri") return { ...base, state: "fail", summary: "Zoho does not know this redirect URI.", fix: `Set the client's redirect URI to ${redirect}.` };
  return { ...base, state: "fail", summary: `Zoho rejected the client (${err || `HTTP ${r.status}`}).`, fix: "The client must be created in the India console (api-console.zoho.in) or have multi-DC enabled." };
}

async function checkSalesforce(env: HealthEnv, f: FetchFn): Promise<IntegrationHealth> {
  const base = { key: "salesforce", name: "Salesforce" };
  const id = set(env, "SALESFORCE_CLIENT_ID");
  const secret = set(env, "SALESFORCE_CLIENT_SECRET");
  const redirect = `${appOriginFrom(env)}/api/integrations/crm/salesforce/callback`;
  if (!id || !secret) return { ...base, state: "off", summary: "Not set up: clients see \"Not switched on yet\".", fix: `Create a Connected App with callback ${redirect}; set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.` };
  const r = await call(f, "https://login.salesforce.com/services/oauth2/token", form({
    grant_type: "authorization_code", client_id: id, client_secret: secret, redirect_uri: redirect, code: BOGUS_CODE,
  }));
  if ("error" in r) return { ...base, state: "fail", summary: `Salesforce unreachable: ${r.error}` };
  const err = String(field(r.body, "error") ?? "");
  if (err === "invalid_grant") return { ...base, state: "ok", summary: "Connected App accepted by Salesforce." };
  if (err === "redirect_uri_mismatch") return { ...base, state: "fail", summary: "Salesforce does not know this callback URL.", fix: `Set the Connected App callback to ${redirect}.` };
  return { ...base, state: "fail", summary: `Salesforce rejected the app (${err || `HTTP ${r.status}`}).`, fix: "Re-copy the Consumer Key and Secret; new Connected Apps take up to 10 minutes to activate." };
}

function checkCron(env: HealthEnv, heartbeatAt: Date | null, now: Date): IntegrationHealth {
  const base = { key: "cron", name: "Scheduled jobs (follow-ups, campaigns, credits)" };
  if (!set(env, "CRON_SECRET")) return { ...base, state: "fail", summary: "CRON_SECRET unset: the job endpoint is open to anyone." };
  if (!heartbeatAt) return { ...base, state: "fail", summary: "The job has never run." };
  const minutes = Math.round((now.getTime() - heartbeatAt.getTime()) / 60_000);
  if (minutes > 60) {
    return { ...base, state: "warn", summary: `Protected, but last run ${minutes >= 120 ? `${Math.round(minutes / 60)}h` : `${minutes}m`} ago: follow-ups and scheduled campaigns run late.`, fix: "Add a 5-minute pinger (cron-job.org) on /api/cron/process-queue with the CRON_SECRET header." };
  }
  return { ...base, state: "ok", summary: `Protected; last run ${minutes}m ago.` };
}

/** Platform-level integrations, all checked in parallel. */
export async function checkPlatformIntegrations(
  env: HealthEnv,
  fetchFn: FetchFn,
  opts: { heartbeatAt: Date | null; now?: Date }
): Promise<IntegrationHealth[]> {
  const results = await Promise.all([
    checkAi(env, fetchFn),
    checkVoice(env, fetchFn),
    checkGoogleCalendar(env, fetchFn),
    checkPlaces(env, fetchFn),
    checkZoho(env, fetchFn),
    checkSalesforce(env, fetchFn),
    checkEmail(env, fetchFn),
    checkRazorpayBilling(env, fetchFn),
    checkStripe(env, fetchFn),
  ]);
  return [...results, checkCron(env, opts.heartbeatAt, opts.now ?? new Date())];
}

// ---------------------------------------------------------------------------
// WhatsApp: per connected number, with that number's own token.

export interface WhatsappNumberInput {
  orgName: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  /** Dedicated client webhook: verified and last inbound, when one exists. */
  connection: { verifiedAt: Date | null; lastInboundAt: Date | null } | null;
  pendingTemplates: number;
  rejectedTemplates: number;
}

export async function checkWhatsappNumber(
  n: WhatsappNumberInput,
  fetchFn: FetchFn,
  apiVersion = "v23.0"
): Promise<IntegrationHealth> {
  const base = { key: `whatsapp:${n.phoneNumberId}`, name: `WhatsApp · ${n.orgName} · ${n.displayName}` };
  const graph = `https://graph.facebook.com/${apiVersion}`;
  const auth = { headers: { Authorization: `Bearer ${n.accessToken}` } };
  const [phone, subs, debug] = await Promise.all([
    call(fetchFn, `${graph}/${n.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status`, auth),
    call(fetchFn, `${graph}/${n.wabaId}/subscribed_apps`, auth),
    call(fetchFn, `${graph}/debug_token?input_token=${encodeURIComponent(n.accessToken)}`, auth),
  ]);
  if ("error" in phone) return { ...base, state: "fail", summary: `Meta unreachable: ${phone.error}` };
  if (phone.status !== 200) {
    const message = String(field(field(phone.body, "error"), "message") ?? `HTTP ${phone.status}`);
    return { ...base, state: "fail", summary: `Meta refused this number's token: ${message.slice(0, 140)}`, fix: "Generate a permanent System User token and reconnect the number in the workspace's WhatsApp settings." };
  }
  const p = phone.body;
  const number = String(field(p, "display_phone_number") ?? n.displayName);
  const quality = String(field(p, "quality_rating") ?? "UNKNOWN");
  const nameStatus = String(field(p, "name_status") ?? "UNKNOWN");
  const problems: string[] = [];
  const fixes: string[] = [];

  const subscribed = !("error" in subs) && subs.status === 200 && Array.isArray(field(subs.body, "data")) && (field(subs.body, "data") as unknown[]).length > 0;
  if (!subscribed) {
    problems.push("the WhatsApp account is not subscribed to any app, so inbound messages never arrive");
    fixes.push(`POST /${n.wabaId}/subscribed_apps with this token`);
  }
  const expiresAt = "error" in debug ? undefined : Number(field(field(debug.body, "data"), "expires_at") ?? NaN);
  if (expiresAt && expiresAt > 0) {
    problems.push(`the token is temporary and expires ${new Date(expiresAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`);
    fixes.push("replace it with a permanent System User token");
  }
  if (n.connection && !n.connection.verifiedAt) {
    problems.push("the client's own webhook has not been verified by Meta");
    fixes.push("paste the callback URL and verify token from WhatsApp settings into Meta → WhatsApp → Configuration");
  }
  if (nameStatus !== "APPROVED" && nameStatus !== "UNKNOWN") problems.push(`display name is ${nameStatus.toLowerCase().replace(/_/g, " ")}`);
  if (quality === "RED") problems.push("quality rating is RED: sending limits will drop");
  if (n.rejectedTemplates) problems.push(`${n.rejectedTemplates} template${n.rejectedTemplates === 1 ? "" : "s"} rejected`);

  const received = n.connection?.lastInboundAt ? ` · last inbound ${n.connection.lastInboundAt.toISOString().slice(0, 10)}` : "";
  const pending = n.pendingTemplates ? ` · ${n.pendingTemplates} template${n.pendingTemplates === 1 ? "" : "s"} awaiting Meta` : "";
  const facts = `${number} · quality ${quality}${received}${pending}`;
  if (!problems.length) return { ...base, state: "ok", summary: facts };
  const fatal = !subscribed;
  return {
    ...base,
    state: fatal ? "fail" : "warn",
    summary: `${facts}. But ${problems.join("; ")}.`,
    fix: fixes.length ? fixes.join("; ") : undefined,
  };
}

// ---------------------------------------------------------------------------
// Customer payments: each workspace's own Razorpay account.

export interface PaymentAccountInput {
  orgName: string;
  keyId: string;
  keySecret: string;
  lastEventAt: Date | null;
}

export async function checkPaymentAccount(p: PaymentAccountInput, fetchFn: FetchFn): Promise<IntegrationHealth> {
  const base = { key: `payments:${p.orgName}:${p.keyId.slice(0, 12)}`, name: `Customer payments · ${p.orgName} (Razorpay)` };
  const r = await call(fetchFn, "https://api.razorpay.com/v1/payments?count=1", {
    headers: { Authorization: `Basic ${Buffer.from(`${p.keyId}:${p.keySecret}`).toString("base64")}` },
  });
  if ("error" in r) return { ...base, state: "fail", summary: `Razorpay unreachable: ${r.error}` };
  if (r.status === 401) return { ...base, state: "fail", summary: "Razorpay now rejects this workspace's keys (regenerated or revoked).", fix: "The owner replaces the keys in Apps → Razorpay." };
  if (r.status !== 200) return { ...base, state: "fail", summary: `Razorpay answered HTTP ${r.status}.` };
  if (!p.keyId.startsWith("rzp_live_")) return { ...base, state: "warn", summary: "Test keys: links work, no real money moves.", fix: "Replace with rzp_live_ keys once Razorpay activates the account." };
  if (!p.lastEventAt) return { ...base, state: "warn", summary: "Keys work, but Razorpay has never called the webhook: paid links would not be marked paid.", fix: "Add the webhook shown in Apps → Razorpay, with event payment_link.paid." };
  return { ...base, state: "ok", summary: `Live keys; last webhook ${p.lastEventAt.toISOString().slice(0, 16).replace("T", " ")} UTC.` };
}
