import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getClaims, redirect, resolveOrgContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  resolveOrgContext: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/modules/orgs/org", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/modules/orgs/org")>(),
  resolveOrgContext,
}));

import { requireOrgContext } from "@/modules/orgs/auth";

const APP_METADATA = {
  provider: "email",
  providers: ["email"],
  nudge_account_origin: "instant_trial_v1",
};

describe("requireOrgContext trial provenance handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getClaims } });
    resolveOrgContext.mockResolvedValue({
      org: { id: "org-trial", suspendedAt: null },
      membership: {
        id: "membership-trial",
        email: "owner@example.com",
        role: "OWNER",
      },
    });
  });

  it.each([
    ["missing", undefined],
    ["malformed", {
      acquisition_trial_id: "trial_1",
      acquisition_trial_token: "short",
    }],
  ])(
    "passes immutable provenance with a null claim for %s trial user_metadata",
    async (_label, userMetadata) => {
      getClaims.mockResolvedValue({
        data: {
          claims: {
            sub: "user-1",
            email: "owner@example.com",
            app_metadata: APP_METADATA,
            user_metadata: userMetadata,
          },
        },
      });

      await requireOrgContext();

      expect(resolveOrgContext).toHaveBeenCalledWith(
        "user-1",
        "owner@example.com",
        {
          appMetadata: APP_METADATA,
          trialClaim: null,
        },
      );
    },
  );
});
