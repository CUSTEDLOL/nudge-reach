import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env-schema";

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("envSchema", () => {
  it("accepts a minimal simulation-mode config", () => {
    const parsed = envSchema.parse(baseEnv);
    expect(parsed.SEND_MODE).toBe("simulation");
    expect(parsed.CAL_EVENT_TYPE_SLUG).toBe("30min");
    expect(parsed.CAL_WEBHOOK_SECRET).toBeUndefined();
  });

  it("accepts an optional Cal webhook secret and event-type slug", () => {
    const parsed = envSchema.parse({
      ...baseEnv,
      CAL_WEBHOOK_SECRET: "cal-secret",
      CAL_EVENT_TYPE_SLUG: "clinic-demo",
    });
    expect(parsed.CAL_WEBHOOK_SECRET).toBe("cal-secret");
    expect(parsed.CAL_EVENT_TYPE_SLUG).toBe("clinic-demo");
  });

  it("accepts an empty optional Cal secret from the example configuration", () => {
    const parsed = envSchema.parse({ ...baseEnv, CAL_WEBHOOK_SECRET: "" });
    expect(parsed.CAL_WEBHOOK_SECRET).toBe("");
  });

  it("defaults the runtime model to Sonnet (rule 3: production tier)", () => {
    const parsed = envSchema.parse(baseEnv);
    expect(parsed.RUNTIME_MODEL).toContain("sonnet");
  });

  it("rejects live mode without the deployment-level webhook secrets", () => {
    const result = envSchema.safeParse({ ...baseEnv, SEND_MODE: "live" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
      expect(paths).toContain("META_APP_SECRET");
      expect(paths).toContain("TOKEN_ENCRYPTION_KEY");
    }
  });

  it("does NOT require env sender credentials in live mode (per-org via dashboard)", () => {
    const result = envSchema.safeParse({ ...baseEnv, SEND_MODE: "live" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).not.toContain("WABA_ID");
      expect(paths).not.toContain("PHONE_NUMBER_ID");
      expect(paths).not.toContain("WHATSAPP_ACCESS_TOKEN");
    }
  });

  it("accepts live mode with only the webhook secrets — no env sender number", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      SEND_MODE: "live",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify",
      META_APP_SECRET: "secret",
      TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid SEND_MODE", () => {
    const result = envSchema.safeParse({ ...baseEnv, SEND_MODE: "yolo" });
    expect(result.success).toBe(false);
  });
});
