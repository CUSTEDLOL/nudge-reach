import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  requireOrg,
  isRestrictedAcquisitionTrial,
  generateCampaignContent,
  storageUpload,
} = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    template: { findFirst: vi.fn(), create: vi.fn() },
    product: { create: vi.fn() },
    campaign: { create: vi.fn() },
  },
  requireOrg: vi.fn(),
  isRestrictedAcquisitionTrial: vi.fn(),
  generateCampaignContent: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrg,
  requireOrgContext: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/modules/trial/capabilities", () => ({
  isRestrictedAcquisitionTrial,
}));
vi.mock("@/modules/campaign/generate", () => ({
  generateCampaignContent,
  marketVoiceForDialCode: () => "international",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: {
      from: () => ({
        upload: storageUpload,
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn.test/photo" } }),
      }),
    },
  }),
}));
vi.mock("@/modules/whatsapp/approval", () => ({
  refreshTemplateStatus: vi.fn(),
  submitTemplateForApproval: vi.fn(),
}));
vi.mock("@/modules/send/queue", () => ({
  enqueueCampaign: vi.fn(),
  processQueue: vi.fn(),
  retryFailedMessages: vi.fn(),
}));

import {
  wizardBlankAction,
  wizardFromPhotoAction,
  wizardFromTemplateAction,
} from "@/app/(app)/campaigns/actions";

describe("restricted trial campaign mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrg.mockResolvedValue({ id: "org_1" });
    isRestrictedAcquisitionTrial.mockResolvedValue(true);
  });

  it.each([
    ["AI photo/copy", wizardFromPhotoAction, { description: "A treatment offer" }],
    ["approved template copy", wizardFromTemplateAction, { templateId: "template_1" }],
    ["blank campaign", wizardBlankAction, { name: "September offer" }],
  ])("blocks %s before model, storage, or database work", async (_case, action, fields) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);

    await expect(action(formData)).resolves.toMatchObject({
      ok: false,
      message: expect.stringMatching(/paid/i),
    });
    expect(generateCampaignContent).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
    expect(prisma.template.findFirst).not.toHaveBeenCalled();
    expect(prisma.product.create).not.toHaveBeenCalled();
    expect(prisma.campaign.create).not.toHaveBeenCalled();
  });
});
