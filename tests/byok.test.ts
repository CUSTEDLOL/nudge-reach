import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E3 BYO-LLM — the resolution + guard contract:
 *  - only an enterprise-flag plan with a valid LlmAccount gets its own driver
 *  - unlisted/junk models are refused (curated allow-list per provider)
 *  - any failure falls back to the platform path (returns null), never throws
 *  - the platform guard still blocks expensive models
 */

const { prisma } = vi.hoisted(() => ({
  prisma: {
    llmAccount: { findUnique: vi.fn() },
    org: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { TOKEN_ENCRYPTION_KEY: "k".repeat(32), SEND_MODE: "simulation" },
}));

import { encryptSecret } from "@/lib/crypto";
import { getByokRuntime } from "@/lib/model-router/byok";
import {
  assertRuntimeModelAllowed,
  isByokModelAllowed,
  BYOK_ALLOWED_MODELS,
} from "@/lib/model-router/guard";

const ACCOUNT = (over: Partial<Record<string, string>> = {}) => ({
  id: "l1",
  orgId: "org1",
  provider: "openai",
  model: "gpt-5-mini",
  apiKeyEncrypted: encryptSecret("sk-customer-key"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ plan: "enterprise" });
  prisma.llmAccount.findUnique.mockResolvedValue(ACCOUNT());
});

describe("getByokRuntime", () => {
  it("resolves an enterprise org's account to its driver + decrypted key", async () => {
    const byok = await getByokRuntime("org1");
    expect(byok).not.toBeNull();
    expect(byok!.provider).toBe("openai");
    expect(byok!.rt.model).toBe("gpt-5-mini");
    expect(byok!.rt.apiKey).toBe("sk-customer-key");
  });

  it("returns null when the plan lacks the byoLlm flag", async () => {
    prisma.org.findUnique.mockResolvedValue({ plan: "growth" });
    expect(await getByokRuntime("org1")).toBeNull();
  });

  it("returns null for a model not on the curated allow-list", async () => {
    prisma.llmAccount.findUnique.mockResolvedValue(
      ACCOUNT({ model: "gpt-o9-ultra-turbo" })
    );
    expect(await getByokRuntime("org1")).toBeNull();
  });

  it("returns null for the sim sentinel and for unknown providers", async () => {
    prisma.llmAccount.findUnique.mockResolvedValue(ACCOUNT({ apiKeyEncrypted: "sim" }));
    expect(await getByokRuntime("org1")).toBeNull();
    prisma.llmAccount.findUnique.mockResolvedValue(ACCOUNT({ provider: "grok" }));
    expect(await getByokRuntime("org1")).toBeNull();
  });

  it("never throws — a DB failure falls back to the platform path", async () => {
    prisma.llmAccount.findUnique.mockRejectedValue(new Error("db down"));
    expect(await getByokRuntime("org1")).toBeNull();
  });
});

describe("guard v2", () => {
  it("platform guard still blocks expensive build-time models", () => {
    for (const bad of ["claude-opus-5", "claude-fable-5", "some-mythos-model"]) {
      expect(() => assertRuntimeModelAllowed(bad)).toThrow();
    }
    expect(() => assertRuntimeModelAllowed("claude-sonnet-5")).not.toThrow();
  });

  it("the BYO allow-list is curated per provider and rejects everything else", () => {
    expect(isByokModelAllowed("openai", "gpt-5-mini")).toBe(true);
    expect(isByokModelAllowed("google", "gemini-3-flash")).toBe(true);
    expect(isByokModelAllowed("anthropic", "claude-sonnet-5")).toBe(true);
    expect(isByokModelAllowed("anthropic", "claude-opus-5")).toBe(false);
    expect(isByokModelAllowed("openai", "made-up-model")).toBe(false);
    expect(isByokModelAllowed("banana", "gpt-5-mini")).toBe(false);
    // No expensive model may ever appear on any list.
    for (const models of Object.values(BYOK_ALLOWED_MODELS)) {
      for (const m of models) {
        expect(m).not.toMatch(/opus|fable|mythos/i);
      }
    }
  });
});
