import { describe, expect, it } from "vitest";
import { runPreflight, type PreflightEnv } from "@/lib/preflight";

/** fetch stub: every Meta/Supabase call succeeds with a minimal body. */
const okFetch: typeof fetch = async () =>
  new Response(JSON.stringify({ id: "123", name: "ok", data: [{ id: "app" }] }), {
    status: 200,
  });

const failFetch: typeof fetch = async () =>
  new Response(JSON.stringify({ error: { message: "bad token" } }), {
    status: 401,
  });

const SIM_ENV: PreflightEnv = {
  SEND_MODE: "simulation",
  RUNTIME_MODEL: "claude-sonnet-5",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
};

const LIVE_ENV: PreflightEnv = {
  ...SIM_ENV,
  SEND_MODE: "live",
  TOKEN_ENCRYPTION_KEY: "k".repeat(64),
  CRON_SECRET: "s",
  META_APP_SECRET: "m",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "v",
  WHATSAPP_ACCESS_TOKEN: "t",
  WABA_ID: "111",
  PHONE_NUMBER_ID: "222",
};

function statusOf(rows: Awaited<ReturnType<typeof runPreflight>>, name: string) {
  const row = rows.find((r) => r.name === name);
  if (!row) throw new Error(`missing check: ${name}`);
  return row.status;
}

describe("runPreflight", () => {
  it("simulation with minimal env has zero FAILs (invariant 4)", async () => {
    const rows = await runPreflight(SIM_ENV, okFetch);
    expect(rows.filter((r) => r.status === "FAIL")).toEqual([]);
  });

  it("live mode without WhatsApp credentials FAILs the Meta checks", async () => {
    const rows = await runPreflight(
      { SEND_MODE: "live", RUNTIME_MODEL: "claude-sonnet-5" },
      okFetch
    );
    expect(statusOf(rows, "WhatsApp access token")).toBe("FAIL");
    expect(statusOf(rows, "Token encryption key")).toBe("FAIL");
    expect(statusOf(rows, "Meta app secret")).toBe("FAIL");
  });

  it("live mode with valid credentials passes Meta checks", async () => {
    const rows = await runPreflight(LIVE_ENV, okFetch);
    expect(statusOf(rows, "WhatsApp access token")).toBe("PASS");
    expect(statusOf(rows, "WABA reachable")).toBe("PASS");
    expect(statusOf(rows, "Phone number reachable")).toBe("PASS");
    expect(statusOf(rows, "Webhook subscription")).toBe("PASS");
  });

  it("a rejected Meta token FAILs the token check", async () => {
    const rows = await runPreflight(LIVE_ENV, failFetch);
    expect(statusOf(rows, "WhatsApp access token")).toBe("FAIL");
  });

  it("a forbidden runtime model FAILs; non-sonnet WARNs", async () => {
    const opus = await runPreflight(
      { ...SIM_ENV, RUNTIME_MODEL: "claude-opus-5" },
      okFetch
    );
    expect(statusOf(opus, "Runtime model")).toBe("FAIL");

    const haiku = await runPreflight(
      { ...SIM_ENV, RUNTIME_MODEL: "claude-haiku-4-5" },
      okFetch
    );
    expect(statusOf(haiku, "Runtime model")).toBe("WARN");
  });

  it("absent Razorpay/Stripe/Google keys WARN, never FAIL", async () => {
    const rows = await runPreflight(LIVE_ENV, okFetch);
    expect(statusOf(rows, "Razorpay keys")).toBe("WARN");
    expect(statusOf(rows, "Stripe keys")).toBe("WARN");
    expect(statusOf(rows, "Google OAuth keys")).toBe("WARN");
  });
});
