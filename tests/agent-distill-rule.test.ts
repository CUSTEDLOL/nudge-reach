// tests/agent-distill-rule.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rule distiller (plan Task 5). The owner never sees the rewrite, so the
 * tests here are mostly about what the distiller REFUSES to store: an invented
 * link, an over-long line, an empty reply. The guardrail's own attack matrix
 * lives in tests/agent-rules.test.ts; this file checks it is wired in with the
 * right `original` — text AND condition — and that the fallback is always the
 * owner's own words.
 */

const { prisma, generate, recordSyntheticUsage, envState } = vi.hoisted(() => ({
  envState: {
    ANTHROPIC_API_KEY: undefined as string | undefined,
    SEND_MODE: "live",
    TOKEN_ENCRYPTION_KEY: "k".repeat(32),
  },
  prisma: {
    org: { findUnique: vi.fn() },
    creditGrant: { aggregate: vi.fn(), create: vi.fn() },
  },
  generate: vi.fn(),
  recordSyntheticUsage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({ env: envState }));
vi.mock("@/lib/model-router", () => ({ generate }));
vi.mock("@/lib/model-router/usage", () => ({ recordSyntheticUsage }));
vi.mock("@/modules/billing/credit-alerts", () => ({ maybeNotifyLowCredits: vi.fn() }));

import { distillRule } from "@/modules/agent/distill-rule";
import { MAX_INSTRUCTION_LENGTH } from "@/modules/agent/rules";
import { assertCreditsAvailable, isAbsorbedPurpose } from "@/modules/billing/credits";

describe("distillRule (model path)", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    envState.ANTHROPIC_API_KEY = "test-key";
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    envState.ANTHROPIC_API_KEY = undefined;
    warn.mockRestore();
  });

  it("returns the model's one-line imperative, attributed to rule_distill", async () => {
    generate.mockResolvedValueOnce(
      "Always point customers to the waitlist at https://getgutfeeling.in/\n"
    );
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "push the waitlist at https://getgutfeeling.in/ whenever someone asks",
      scope: "always",
    });
    expect(instruction).toBe("Always point customers to the waitlist at https://getgutfeeling.in/");
    expect(warn).not.toHaveBeenCalled();

    const call = generate.mock.calls[0][0];
    expect(call.attribution).toEqual({ orgId: "o1", purpose: "rule_distill" });
    expect(call.maxTokens).toBeLessThanOrEqual(200);
    expect(call.prompt).toContain("push the waitlist at https://getgutfeeling.in/");
    expect(call.prompt).toContain("always");
  });

  it("rejects a distillation that invents a link, and never logs the owner's words", async () => {
    generate.mockResolvedValueOnce("Always send customers to https://evil.example/ to sign up.");
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "push the waitlist",
      scope: "always",
    });
    expect(instruction).toBe("Always: push the waitlist");
    expect(instruction).not.toContain("evil.example");
    expect(warn).toHaveBeenCalledWith("[rule-distill] rejected", { orgId: "o1" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("waitlist");
  });

  // The Task 2 reviewer's finding: the guardrail's `original` must be the text
  // AND the condition, or every correct "when" distillation whose link lives in
  // the condition is rejected as an invention.
  it("accepts a when-rule whose link lives in the condition", async () => {
    generate.mockResolvedValueOnce(
      "When someone asks to book, send them https://book.example.com/glow."
    );
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "send them the booking link",
      scope: "when",
      condition: "someone asks to book at https://book.example.com/glow",
    });
    expect(instruction).toContain("https://book.example.com/glow");
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects an over-long line: the instruction rides in every reply", async () => {
    generate.mockResolvedValueOnce(`Always ${"be nice ".repeat(40)}`);
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "be polite to everyone",
      scope: "always",
    });
    expect(instruction).toBe("Always: be polite to everyone");
    expect(instruction.length).toBeLessThanOrEqual(MAX_INSTRUCTION_LENGTH);
    expect(warn).toHaveBeenCalledWith("[rule-distill] rejected", { orgId: "o1" });
  });

  it("rejects an empty or whitespace-only reply", async () => {
    generate.mockResolvedValueOnce("   \n  ");
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "quote prices over WhatsApp",
      scope: "never",
    });
    // The scope has to survive the fallback: a bare "quote prices over
    // WhatsApp" bullet under HOUSE RULES would order the opposite.
    expect(instruction).toBe("Never: quote prices over WhatsApp");
    expect(warn).toHaveBeenCalledWith("[rule-distill] rejected", { orgId: "o1" });
  });

  it("falls back to the owner's words, capped, when the provider fails", async () => {
    generate.mockRejectedValueOnce(new Error("provider down"));
    const { instruction } = await distillRule({
      orgId: "o1",
      text: `a${"b".repeat(400)}`,
      scope: "always",
    });
    expect(instruction).toHaveLength(MAX_INSTRUCTION_LENGTH);
    expect(instruction.startsWith("Always: ab")).toBe(true);
  });

  it("tells the model to preserve specifics and to keep the agent to this business", async () => {
    generate.mockResolvedValueOnce("Always greet customers in Hindi.");
    await distillRule({ orgId: "o1", text: "greet people in hindi", scope: "always" });
    const { system } = generate.mock.calls[0][0];
    expect(system).toContain(
      "Preserve every number, price, URL and email address exactly as written. Never move a number to a different subject, and never introduce one."
    );
    expect(system).toContain("only ever speaks for this one business");
    expect(system).toContain("under 200 characters");
    // The words-not-digits gap the token guardrail cannot see.
    expect(system).toMatch(/five hundred rupees/);
  });
});

describe("distillRule without a key (invariant #4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never calls the model, keeps the owner's words and meters a synthetic row", async () => {
    const { instruction } = await distillRule({
      orgId: "o1",
      text: "  never promise results  ",
      scope: "never",
    });
    expect(instruction).toBe("Never: never promise results");
    expect(generate).not.toHaveBeenCalled();
    expect(recordSyntheticUsage).toHaveBeenCalledWith(
      { orgId: "o1", purpose: "rule_distill" },
      "never promise results",
      "Never: never promise results"
    );
  });
});

describe("rule_distill is absorbed (the platform pays for setup work)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets a zero-credit org author a rule: the preflight returns before the balance read", async () => {
    expect(isAbsorbedPurpose("rule_distill")).toBe(true);
    // Both would be reached only if the absorbed branch were missing.
    prisma.org.findUnique.mockRejectedValue(new Error("preflight must not read the org"));
    prisma.creditGrant.aggregate.mockResolvedValue({ _sum: { remainingMicroUsd: 0 } });

    await expect(
      assertCreditsAvailable({ orgId: "o1", purpose: "rule_distill" })
    ).resolves.toBe("absorbed");
    expect(prisma.org.findUnique).not.toHaveBeenCalled();
    expect(prisma.creditGrant.aggregate).not.toHaveBeenCalled();
  });
});
