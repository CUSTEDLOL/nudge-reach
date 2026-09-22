import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrgContext,
  activateTrialAgentIfGrounded,
  revalidatePath,
  redirect,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  activateTrialAgentIfGrounded: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/modules/trial/activation", () => ({
  activateTrialAgentIfGrounded,
}));

import { completeTrialSetupAction } from "@/app/(app)/trial/setup/actions";

const ctx = {
  role: "OWNER",
  org: { id: "org_1", name: "Northstar Services", vertical: "services" },
};

describe("complete trial setup recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue(ctx);
    activateTrialAgentIfGrounded.mockResolvedValue({ status: "activated" });
  });

  it("uses the shared activation boundary and opens the trial Inbox", async () => {
    await expect(completeTrialSetupAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(activateTrialAgentIfGrounded).toHaveBeenCalledWith(ctx);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/agent");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps the friendly no-knowledge recovery message", async () => {
    activateTrialAgentIfGrounded.mockResolvedValue({ status: "no_knowledge" });

    await expect(completeTrialSetupAction()).resolves.toEqual({
      ok: false,
      message: "Approve at least one business fact before opening your trial.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects converted, paid, or missing trial workspaces", async () => {
    activateTrialAgentIfGrounded.mockResolvedValue({
      status: "not_restricted",
    });

    await expect(completeTrialSetupAction()).resolves.toEqual({
      ok: false,
      message: "This free-trial setup is no longer available.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps unexpected activation failures user-safe", async () => {
    activateTrialAgentIfGrounded.mockRejectedValue(new Error("database down"));

    await expect(completeTrialSetupAction()).resolves.toEqual({
      ok: false,
      message: "Couldn't finish your trial setup. Please try again.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("legacy trial setup route", () => {
  it("redirects to the continuous Train AI page", () => {
    const source = readFileSync(
      new URL("../src/app/(app)/trial/setup/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('redirect("/agent")');
    expect(source).not.toContain("<TrialSetup");
    expect(source).not.toContain("questionnaireScript");
  });
});
