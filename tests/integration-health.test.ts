import { describe, expect, it } from "vitest";
import {
  checkPlatformIntegrations,
  checkWhatsappNumber,
  googleRedirectFor,
  type HealthEnv,
} from "@/modules/admin/integration-health";

/**
 * The founder's "is everything really working?" page. Each provider is
 * answered from a fake fetch; the rules under test are how an answer is read.
 */

type Route = (url: string, init?: RequestInit) => { status: number; body: unknown };
const fakeFetch = (route: Route) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    const { status, body } = route(String(input), init);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;

const NOW = new Date("2026-09-26T12:00:00Z");
const fresh = new Date("2026-09-26T11:55:00Z");

const byKey = async (env: HealthEnv, route: Route, heartbeatAt: Date | null = fresh) => {
  const rows = await checkPlatformIntegrations(env, fakeFetch(route), { heartbeatAt, now: NOW });
  return Object.fromEntries(rows.map((r) => [r.key, r]));
};

const everythingFine: Route = (url) => {
  if (url.includes("api.anthropic.com")) return { status: 200, body: { data: [{ id: "claude-sonnet-5" }] } };
  if (url.includes("convai/agents")) return { status: 200, body: { agent_id: "a1" } };
  if (url.includes("convai/settings")) return { status: 200, body: { webhooks: { post_call_webhook_id: "w1" } } };
  if (url.includes("convai/phone-numbers")) return { status: 200, body: [{ phone_number: "+91..." }] };
  if (url.includes("oauth2.googleapis.com")) return { status: 400, body: { error: "invalid_grant" } };
  if (url.includes("places.googleapis.com")) return { status: 200, body: { places: [{ id: "p" }] } };
  if (url.includes("accounts.zoho.in")) return { status: 200, body: { error: "invalid_code" } };
  if (url.includes("login.salesforce.com")) return { status: 400, body: { error: "invalid_grant" } };
  if (url.includes("api.resend.com/domains")) return { status: 200, body: { data: [{ name: "nudgeagent.app", status: "verified" }] } };
  if (url.includes("api.razorpay.com")) return { status: 200, body: { items: [] } };
  if (url.includes("api.stripe.com")) return { status: 200, body: { available: [] } };
  return { status: 404, body: {} };
};

const FULL: HealthEnv = {
  NEXT_PUBLIC_APP_URL: "https://nudgeagent.app",
  ANTHROPIC_API_KEY: "sk-ant-x",
  RUNTIME_MODEL: "claude-sonnet-5",
  ELEVENLABS_API_KEY: "xi",
  ELEVENLABS_AGENT_ID: "a1",
  GOOGLE_CLIENT_ID: "g.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-x",
  GOOGLE_MAPS_API_KEY: "AIza",
  ZOHO_CLIENT_ID: "1000.X",
  ZOHO_CLIENT_SECRET: "z",
  SALESFORCE_CLIENT_ID: "3MVG",
  SALESFORCE_CLIENT_SECRET: "s",
  RESEND_API_KEY: "re_x",
  EMAIL_FROM: "Nudge <hello@nudgeagent.app>",
  RAZORPAY_KEY_ID: "rzp_live_x",
  RAZORPAY_KEY_SECRET: "r",
  RAZORPAY_WEBHOOK_SECRET: "w",
  STRIPE_SECRET_KEY: "sk_live_x",
  STRIPE_WEBHOOK_SECRET: "whsec",
  CRON_SECRET: "c",
};

describe("checkPlatformIntegrations", () => {
  it("reports every provider as working when each accepts the keys", async () => {
    const rows = await byKey(FULL, everythingFine);
    for (const key of ["ai", "voice", "google-calendar", "google-places", "zoho", "salesforce", "email", "razorpay-billing", "stripe", "cron"]) {
      expect(rows[key]?.state, key).toBe("ok");
    }
  });

  it("marks unset integrations as not set up, but a missing AI key as broken", async () => {
    const rows = await byKey({}, everythingFine);
    expect(rows.ai.state).toBe("fail");
    expect(rows["google-calendar"].state).toBe("off");
    expect(rows["google-calendar"].fix).toContain("https://nudgeagent.app/api/integrations/google/callback");
    expect(rows.zoho.state).toBe("off");
    expect(rows.email.state).toBe("off");
  });

  it("reads OAuth 'bad code' as accepted credentials and 'bad client' as broken", async () => {
    const rows = await byKey(FULL, (url, init) => {
      if (url.includes("oauth2.googleapis.com")) return { status: 401, body: { error: "invalid_client" } };
      if (url.includes("accounts.zoho.in")) return { status: 200, body: { error: "invalid_client" } };
      if (url.includes("login.salesforce.com")) return { status: 400, body: { error: "invalid_client_id" } };
      return everythingFine(url, init);
    });
    expect(rows["google-calendar"].state).toBe("fail");
    expect(rows.zoho.state).toBe("fail");
    expect(rows.salesforce.state).toBe("fail");
  });

  it("catches an AI model id the account does not have", async () => {
    const rows = await byKey({ ...FULL, RUNTIME_MODEL: "claude-sonet-5" }, everythingFine);
    expect(rows.ai.state).toBe("warn");
  });

  it("flags voice without a post-call webhook as broken and without a number as a warning", async () => {
    const noHook = await byKey(FULL, (url, init) =>
      url.includes("convai/settings") ? { status: 200, body: { webhooks: {} } } : everythingFine(url, init));
    expect(noHook.voice.state).toBe("fail");
    const noNumber = await byKey(FULL, (url, init) =>
      url.includes("convai/phone-numbers") ? { status: 200, body: [] } : everythingFine(url, init));
    expect(noNumber.voice.state).toBe("warn");
  });

  it("refuses an email domain Resend has not verified", async () => {
    const rows = await byKey(FULL, (url, init) =>
      url.includes("resend.com") ? { status: 200, body: { data: [{ name: "nudgeagent.app", status: "pending" }] } } : everythingFine(url, init));
    expect(rows.email.state).toBe("fail");
    expect(rows.email.summary).toContain("pending");
  });

  it("warns on Razorpay test keys and fails without a webhook secret", async () => {
    const test = await byKey({ ...FULL, RAZORPAY_KEY_ID: "rzp_test_x" }, everythingFine);
    expect(test["razorpay-billing"].state).toBe("warn");
    const noHook = await byKey({ ...FULL, RAZORPAY_WEBHOOK_SECRET: "" }, everythingFine);
    expect(noHook["razorpay-billing"].state).toBe("fail");
  });

  it("grades the job runner by its last heartbeat", async () => {
    expect((await byKey(FULL, everythingFine, new Date("2026-09-26T09:00:00Z"))).cron.state).toBe("warn");
    expect((await byKey(FULL, everythingFine, null)).cron.state).toBe("fail");
    expect((await byKey({ ...FULL, CRON_SECRET: "" }, everythingFine)).cron.state).toBe("fail");
  });

  it("never throws when a provider is down", async () => {
    const rows = await checkPlatformIntegrations(FULL, (async () => { throw new Error("offline"); }) as typeof fetch, { heartbeatAt: fresh, now: NOW });
    expect(rows.find((r) => r.key === "ai")?.state).toBe("fail");
    expect(rows.find((r) => r.key === "ai")?.summary).toContain("offline");
  });

  it("defaults Google's redirect to the app's own callback", () => {
    expect(googleRedirectFor({ NEXT_PUBLIC_APP_URL: "https://nudgeagent.app/" })).toBe("https://nudgeagent.app/api/integrations/google/callback");
    expect(googleRedirectFor({ GOOGLE_OAUTH_REDIRECT_URI: "https://x.test/cb" })).toBe("https://x.test/cb");
  });
});

describe("checkWhatsappNumber", () => {
  const number = {
    orgName: "Aster",
    displayName: "Aster Clinic",
    wabaId: "3064885677036509",
    phoneNumberId: "1229329206928207",
    accessToken: "EAAG",
    connection: { verifiedAt: new Date("2026-09-20"), lastInboundAt: new Date("2026-09-25") },
    pendingTemplates: 0,
    rejectedTemplates: 0,
  };
  const meta = (over: Partial<Record<"phone" | "subs" | "debug", { status: number; body: unknown }>> = {}): Route => (url) => {
    if (url.includes("/subscribed_apps")) return over.subs ?? { status: 200, body: { data: [{ id: "app" }] } };
    if (url.includes("/debug_token")) return over.debug ?? { status: 200, body: { data: { expires_at: 0, is_valid: true } } };
    return over.phone ?? { status: 200, body: { display_phone_number: "+91 98765 43210", quality_rating: "GREEN", name_status: "APPROVED" } };
  };

  it("is working when Meta knows the number, the WABA is subscribed and the token is permanent", async () => {
    const r = await checkWhatsappNumber(number, fakeFetch(meta()));
    expect(r.state).toBe("ok");
    expect(r.summary).toContain("+91 98765 43210");
  });

  it("is broken when the WABA is subscribed to no app: inbound never arrives (the July bug)", async () => {
    const r = await checkWhatsappNumber(number, fakeFetch(meta({ subs: { status: 200, body: { data: [] } } })));
    expect(r.state).toBe("fail");
    expect(r.summary).toMatch(/inbound messages never arrive/);
  });

  it("warns about a temporary token before it expires", async () => {
    const r = await checkWhatsappNumber(number, fakeFetch(meta({ debug: { status: 200, body: { data: { expires_at: 1790000000 } } } })));
    expect(r.state).toBe("warn");
    expect(r.summary).toMatch(/temporary/);
  });

  it("is broken when Meta refuses the token", async () => {
    const r = await checkWhatsappNumber(number, fakeFetch(meta({ phone: { status: 401, body: { error: { message: "Session has expired" } } } })));
    expect(r.state).toBe("fail");
    expect(r.summary).toContain("Session has expired");
  });
});
