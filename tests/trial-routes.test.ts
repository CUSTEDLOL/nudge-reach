import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isTrialWorkspacePath,
  trialExploreRedirect,
} from "@/modules/trial/routes";

describe("trial workspace routes", () => {
  it.each([
    ["/dashboard", true],
    ["/trial/setup", true],
    ["/agent", true],
    ["/inbox/try", true],
    ["/inbox/conversation_1", true],
    ["/explore", true],
    ["/settings/billing", true],
    ["/campaigns", false],
    ["/inbox", false],
    ["/inbox/conversation_1/edit", false],
    ["/settings/whatsapp", false],
    ["/agent/voice", false],
  ])("classifies %s", (pathname, allowed) => {
    expect(isTrialWorkspacePath(pathname)).toBe(allowed);
  });

  it("turns a paid direct route into an encoded Explore preview", () => {
    expect(trialExploreRedirect("/campaigns/new")).toBe(
      "/explore?feature=campaigns",
    );
    expect(trialExploreRedirect("/settings/whatsapp")).toBe(
      "/explore?feature=settings",
    );
  });

  it("wires only the trusted proxy pathname into the authenticated layout", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(layout).toContain('get("x-nudge-pathname")');
    expect(layout).toContain("isTrialWorkspacePath");
    expect(layout).toContain("trialExploreRedirect");
  });
});
