import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runFounderAction,
  revalidatePath,
  founderRetryCampaign,
  founderRetryCrmJob,
  founderRefreshTemplate,
} = vi.hoisted(() => ({
  runFounderAction: vi.fn(async (work: (founder: { email: string }) => Promise<unknown>) =>
    work({ email: "founder@nudge.test" })
  ),
  revalidatePath: vi.fn(),
  founderRetryCampaign: vi.fn(),
  founderRetryCrmJob: vi.fn(),
  founderRefreshTemplate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/modules/admin/actions", () => ({ runFounderAction }));
vi.mock("@/modules/admin/ops", () => ({
  founderRetryCampaign,
  founderRetryCrmJob,
  founderRefreshTemplate,
}));

import {
  refreshTemplateAction,
  retryCampaignAction,
  retryCrmJobAction,
} from "@/app/admin/ops/actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  founderRetryCampaign.mockResolvedValue({ ok: true, message: "Campaign retry queued." });
  founderRetryCrmJob.mockResolvedValue({ ok: true, message: "CRM retry queued." });
  founderRefreshTemplate.mockResolvedValue({ ok: true, message: "Template refreshed." });
});

describe("founder recovery route actions", () => {
  it("rejects a missing reason before any recovery call", async () => {
    const result = await retryCampaignAction(form({
      orgId: "org-1",
      campaignId: "campaign-1",
      confirmation: "Recall",
      reason: "",
    }));
    expect(result.ok).toBe(false);
    expect(founderRetryCampaign).not.toHaveBeenCalled();
  });

  it("passes exact scope to each recovery and revalidates ops plus the org", async () => {
    const reason = "Customer approved an operational retry.";
    await retryCampaignAction(form({ orgId: "org-1", campaignId: "campaign-1", confirmation: "Recall", reason }));
    await retryCrmJobAction(form({ orgId: "org-1", jobId: "job-1", confirmation: "job-1", reason }));
    await refreshTemplateAction(form({ orgId: "org-1", templateId: "template-1", confirmation: "reminder", reason }));

    expect(founderRetryCampaign).toHaveBeenCalledWith("org-1", "campaign-1", "founder@nudge.test", reason, "Recall");
    expect(founderRetryCrmJob).toHaveBeenCalledWith("org-1", "job-1", "founder@nudge.test", reason, "job-1");
    expect(founderRefreshTemplate).toHaveBeenCalledWith("org-1", "template-1", "founder@nudge.test", reason, "reminder");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/ops");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orgs/org-1", "layout");
  });
});
