import { describe, expect, it } from "vitest";
import { assertRuntimeModelAllowed } from "@/lib/model-router/guard";

describe("assertRuntimeModelAllowed (rule 3: no expensive models at runtime)", () => {
  it("allows the cheap Haiku tier", () => {
    expect(() => assertRuntimeModelAllowed("claude-haiku-4-5")).not.toThrow();
    expect(() =>
      assertRuntimeModelAllowed("claude-haiku-4-5-20251001")
    ).not.toThrow();
  });

  it("allows Sonnet (the production runtime tier)", () => {
    expect(() => assertRuntimeModelAllowed("claude-sonnet-5")).not.toThrow();
  });

  it("rejects Opus", () => {
    expect(() => assertRuntimeModelAllowed("claude-opus-4-8")).toThrow(
      /rule 3/
    );
  });

  it("rejects Fable", () => {
    expect(() => assertRuntimeModelAllowed("claude-fable-5")).toThrow(/rule 3/);
  });

  it("rejects Mythos", () => {
    expect(() => assertRuntimeModelAllowed("claude-mythos-5")).toThrow(
      /rule 3/
    );
  });

  it("is case-insensitive", () => {
    expect(() => assertRuntimeModelAllowed("Claude-OPUS-4-8")).toThrow();
  });
});
