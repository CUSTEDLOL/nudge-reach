import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isTrialWorkspacePath,
  trialWorkspaceRedirect,
} from "@/modules/trial/routes";

describe("trial workspace routes", () => {
  it.each([
    ["/dashboard", true],
    ["/trial/setup", true],
    ["/agent", true],
    ["/inbox/try", true],
    ["/settings/billing", true],
    ["/inbox/conversation_1", false],
    ["/explore", false],
    ["/campaigns", false],
    ["/inbox", false],
    ["/inbox/conversation_1/edit", false],
    ["/settings/whatsapp", false],
    ["/agent/voice", false],
  ])("classifies %s", (pathname, allowed) => {
    expect(isTrialWorkspacePath(pathname)).toBe(allowed);
  });

  it("turns unsupported routes into an encoded Inbox upgrade notice", () => {
    expect(trialWorkspaceRedirect("/explore")).toBe(
      "/dashboard?upgrade=explore",
    );
    expect(trialWorkspaceRedirect("/campaigns/new")).toBe(
      "/dashboard?upgrade=campaigns",
    );
    expect(trialWorkspaceRedirect("/settings/whatsapp?next=/explore")).toBe(
      "/dashboard?upgrade=settings",
    );
    expect(trialWorkspaceRedirect("/%2Funsafe")).toBe(
      "/dashboard?upgrade=%252Funsafe",
    );
  });

  it("wires only the trusted proxy pathname into the authenticated layout", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(layout).toContain('get("x-nudge-pathname")');
    expect(layout).toContain("isTrialWorkspacePath");
    expect(layout).toContain("trialWorkspaceRedirect");
    expect(layout).not.toContain("trialExploreRedirect");
  });
});
