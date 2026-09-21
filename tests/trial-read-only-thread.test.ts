import { describe, expect, it } from "vitest";
import {
  isTrialWorkspacePath,
  trialWorkspaceRedirect,
} from "@/modules/trial/routes";

describe("legacy trial thread routes", () => {
  it("keeps an active trial out of paid shared-inbox threads", () => {
    expect(isTrialWorkspacePath("/inbox/conversation_1")).toBe(false);
    expect(trialWorkspaceRedirect("/inbox/conversation_1")).toBe(
      "/dashboard?upgrade=inbox",
    );
  });
});
