import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOrgContext,
  getTrialWorkspace,
  getDashboardData,
  dashboardRedirectFor,
} = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  getTrialWorkspace: vi.fn(),
  getDashboardData: vi.fn(),
  dashboardRedirectFor: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => ({ requireOrgContext }));
vi.mock("@/modules/trial/workspace", () => ({
  getTrialWorkspace,
  dashboardRedirectFor,
}));
vi.mock("@/modules/dashboard/queries", () => ({ getDashboardData }));
vi.mock("@/components/features/trial/trial-inbox", async () => {
  const { createElement } = await import("react");
  return {
    TrialInbox: () => createElement("div", null, "Trial Inbox"),
  };
});

import DashboardPage from "@/app/(app)/dashboard/page";

const activeTrial = {
  id: "trial_1",
  status: "active",
  converted: false,
};

describe("dashboard trial data boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrgContext.mockResolvedValue({
      org: {
        id: "org_1",
        name: "Northstar Services",
        timezone: "Asia/Kolkata",
      },
      membership: {
        role: "OWNER",
        whatsappAccountIds: [],
      },
      email: "owner@example.com",
    });
  });

  it("returns the private Inbox without requesting paid dashboard data", async () => {
    getTrialWorkspace.mockResolvedValue(activeTrial);

    const page = await DashboardPage({ searchParams: Promise.resolve({}) });

    expect(page.props.workspace).toBe(activeTrial);
    expect(getTrialWorkspace).toHaveBeenCalledWith("org_1");
    expect(getDashboardData).not.toHaveBeenCalled();
  });

  it("still requests dashboard data for a normal paid workspace", async () => {
    getTrialWorkspace.mockResolvedValue(null);
    getDashboardData.mockRejectedValue(new Error("PAID_DASHBOARD_QUERY"));

    await expect(
      DashboardPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("PAID_DASHBOARD_QUERY");

    expect(getDashboardData).toHaveBeenCalledOnce();
  });
});
