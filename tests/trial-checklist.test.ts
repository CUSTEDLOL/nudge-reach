import { describe, expect, it } from "vitest";
import { buildTrialChecklist } from "@/modules/trial/checklist";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const workspace = {
  knowledgeReady: true,
  firstReplyAt: null,
  exploreViewed: false,
  demoBooked: false,
} as TrialWorkspace;

describe("trial checklist", () => {
  it("derives every completion state from the server workspace", () => {
    expect(buildTrialChecklist(workspace).map((item) => [item.key, item.done])).toEqual([
      ["teach", true],
      ["test", false],
      ["explore", false],
      ["demo", false],
    ]);
  });

  it("links each task to the real product destination", () => {
    expect(buildTrialChecklist(workspace).map((item) => item.href)).toEqual([
      "/agent",
      "/inbox/try",
      "/explore",
      "#trial-conversion",
    ]);
  });
});
