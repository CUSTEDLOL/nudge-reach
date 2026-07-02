import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit inside the window", () => {
    const t = 1_000_000;
    expect(checkRateLimit("k", RULE, t).allowed).toBe(true);
    expect(checkRateLimit("k", RULE, t + 1).allowed).toBe(true);
    expect(checkRateLimit("k", RULE, t + 2).allowed).toBe(true);
    const fourth = checkRateLimit("k", RULE, t + 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("slides: old hits expire and free capacity", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k", RULE, t + i);
    expect(checkRateLimit("k", RULE, t + 10).allowed).toBe(false);
    // One window later the first hits have expired.
    expect(checkRateLimit("k", RULE, t + RULE.windowMs + 5).allowed).toBe(true);
  });

  it("keys are independent", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", RULE, t + i);
    expect(checkRateLimit("a", RULE, t + 4).allowed).toBe(false);
    expect(checkRateLimit("b", RULE, t + 4).allowed).toBe(true);
  });

  it("reports retryAfter as seconds until the oldest hit leaves", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k", RULE, t);
    const blocked = checkRateLimit("k", RULE, t + 30_000);
    expect(blocked.retryAfterSeconds).toBe(30);
  });
});
