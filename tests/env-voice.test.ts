import { describe, expect, it } from "vitest";
import { envSchema } from "@/lib/env-schema";

const baseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  SEND_MODE: "simulation",
};

describe("voice env", () => {
  it("defaults ELEVENLABS_LLM to a cheap model and keeps voice keys optional", () => {
    const parsed = envSchema.parse(baseEnv);
    expect(parsed.ELEVENLABS_LLM).toBe("claude-haiku-4-5");
    expect(parsed.ELEVENLABS_API_KEY).toBeUndefined();
  });

  it("rejects an expensive voice model", () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, ELEVENLABS_LLM: "claude-opus-5" })
    ).toThrow(/expensive/);
  });
});
