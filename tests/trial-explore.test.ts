import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirect, requireOrgContext, requireAcquisitionTrial } = vi.hoisted(
  () => ({
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
    requireOrgContext: vi.fn(async () => ({ org: { id: "org_1" } })),
    requireAcquisitionTrial: vi.fn(async () => ({})),
  }),
);

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/modules/trial/workspace", () => ({ requireAcquisitionTrial }));

import ExplorePage from "@/app/(app)/explore/page";

describe("legacy Explore route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects safely to the canonical trial Inbox", async () => {
    const page = ExplorePage as unknown as (input?: {
      searchParams: Promise<{ feature?: string }>;
    }) => Promise<unknown>;

    await expect(
      page({ searchParams: Promise.resolve({ feature: "crm" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("does not import or call the retired client preview module", () => {
    const source = readFileSync(
      new URL("../src/app/(app)/explore/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain('redirect("/dashboard")');
    expect(source).not.toContain("locked-feature-card");
    expect(source).not.toContain("LockedFeatureCard");
    expect(source).not.toContain("TRIAL_LOCKED_FEATURES");
    expect(source).not.toContain("lockedFeatureForSegment");
    expect(source).not.toContain("MarkExploreViewed");
    expect(source).not.toContain('"use client"');
  });
});
