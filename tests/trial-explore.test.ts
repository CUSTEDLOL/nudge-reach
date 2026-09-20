import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOrgContext, updateMany, revalidatePath } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  updateMany: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/lib/db", () => ({
  prisma: { acquisitionTrial: { updateMany } },
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { markTrialExploreViewedAction } from "@/app/(app)/trial/actions";
import {
  TRIAL_LOCKED_FEATURES,
  lockedFeatureForSegment,
} from "@/components/features/trial/locked-feature-card";
import { LockedFeatureCard } from "@/components/features/trial/locked-feature-card";
import { UpgradeDialogActions } from "@/components/features/trial/upgrade-dialog";

describe("trial Explore previews", () => {
  beforeEach(() => {
    requireOrgContext.mockReset();
    updateMany.mockReset();
    revalidatePath.mockReset();
    requireOrgContext.mockResolvedValue({ org: { id: "org_1" } });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("keeps the seven locked previews in the approved conversion order", () => {
    expect(TRIAL_LOCKED_FEATURES.map((feature) => feature.title)).toEqual([
      "Connect your WhatsApp number",
      "Calendar booking",
      "Follow up with quiet leads",
      "Payment links",
      "Campaigns to opted-in customers",
      "CRM sync",
      "Voice Front Desk",
    ]);
  });

  it("renders an explained lock and never links the card to a mutation", () => {
    for (const feature of TRIAL_LOCKED_FEATURES) {
      const html = renderToStaticMarkup(
        createElement(LockedFeatureCard, { feature, initiallyOpen: false }),
      );
      expect(html).toContain(feature.title);
      expect(html).toContain("Locked in the free trial");
      expect(html).toContain("Unlock this");
      expect(html).toContain("aria-describedby=");
      expect(html).not.toContain(`href="${feature.paidHref}"`);
    }
  });

  it("puts the demo first and paid plans second in the upgrade dialog", () => {
    const html = renderToStaticMarkup(
      createElement(UpgradeDialogActions, { featureName: "Calendar booking" }),
    );
    expect(html).toContain("Book a free demo");
    expect(html).toContain('href="/pricing"');
    expect(html.indexOf("Book a free demo")).toBeLessThan(
      html.indexOf("See paid plans"),
    );
  });

  it("maps direct paid routes to the closest preview", () => {
    expect(lockedFeatureForSegment("campaigns")).toBe("campaigns");
    expect(lockedFeatureForSegment("automations")).toBe("followups");
    expect(lockedFeatureForSegment("settings")).toBe("whatsapp");
    expect(lockedFeatureForSegment("agent")).toBe("voice");
  });

  it("marks Explore once with an org-scoped idempotent update", async () => {
    await markTrialExploreViewedAction();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        orgId: "org_1",
        convertedAt: null,
        exploreViewedAt: null,
      },
      data: { exploreViewedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
