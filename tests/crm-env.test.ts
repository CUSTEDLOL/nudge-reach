import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env-schema";

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  SEND_MODE: "simulation",
};

describe("crm env", () => {
  it("keeps CRM keys optional", () => {
    const parsed = envSchema.parse(baseEnv);
    expect(parsed.ZOHO_CLIENT_ID).toBeUndefined();
    expect(parsed.SALESFORCE_CLIENT_ID).toBeUndefined();
  });
});
