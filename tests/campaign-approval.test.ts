import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findCampaign: vi.fn(), createTemplate: vi.fn(), updateCampaign: vi.fn(),
  credentials: vi.fn(), mode: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  campaign: { findFirst: mocks.findCampaign, update: mocks.updateCampaign },
  template: { create: mocks.createTemplate },
} }));
vi.mock("@/modules/orgs/mode", () => ({ orgSendMode: mocks.mode }));
vi.mock("@/modules/whatsapp/accounts", () => ({ getWhatsappCredentials: mocks.credentials }));
import { submitTemplateForApproval } from "@/modules/whatsapp/approval";
const content = {
  productName: "Nudge", campaignAngle: "Reply to enquiries", header: "Meet Nudge",
  body: "Hi {{1}}, meet your new front desk.", footer: "Reply STOP to unsubscribe",
  buttons: [{ type: "URL", text: "Get started", url: "https://example.com/old" }],
  sampleName: "Priya", imageTreatment: "None", notes: "",
};
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch);
  mocks.mode.mockResolvedValue("live");
  mocks.credentials.mockResolvedValue({ wabaId: "account", accessToken: "test-token" });
  mocks.findCampaign.mockResolvedValue({ id: "campaign123456", orgId: "org", content, product: { photoUrl: null } });
  mocks.createTemplate.mockImplementation(async ({ data }) => ({ id: "local", ...data }));
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "meta" }) });
});
describe("campaign template resubmission", () => {
  it("submits an edited URL under a fresh name instead of colliding with the pending template", async () => {
    await submitTemplateForApproval("campaign123456", "org");
    mocks.findCampaign.mockResolvedValue({ id: "campaign123456", orgId: "org", content: {
      ...content, buttons: [{ type: "URL", text: "Get started", url: "https://nudgeagent.app/" }],
    }, product: { photoUrl: null } });
    await submitTemplateForApproval("campaign123456", "org");
    const bodies = mocks.fetch.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(bodies[1].name).not.toBe(bodies[0].name);
    expect(bodies[1].name).toMatch(/^[a-z0-9_]+$/);
    expect(bodies[1].components.find((c: { type: string }) => c.type === "BUTTONS").buttons[0].url).toBe("https://nudgeagent.app/");
    expect(mocks.createTemplate.mock.calls[1][0].data.name).toBe(bodies[1].name);
  });
  it("shows Meta's actionable error rather than its generic invalid-parameter message", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: {
      message: "Invalid parameter", error_user_msg: "There is already English content for this template. You can create a new template and try again.",
    } }) });
    await expect(submitTemplateForApproval("campaign123456", "org")).rejects.toThrow("There is already English content");
    expect(mocks.createTemplate).not.toHaveBeenCalled();
    expect(mocks.updateCampaign).not.toHaveBeenCalled();
  });
  it("does not contact Meta in simulation", async () => {
    mocks.mode.mockResolvedValue("simulation");
    await submitTemplateForApproval("campaign123456", "org");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.createTemplate).toHaveBeenCalled();
  });
  it("does not submit a campaign outside the requested workspace", async () => {
    mocks.findCampaign.mockResolvedValue(null);
    await expect(submitTemplateForApproval("other", "org")).rejects.toThrow("Campaign not found");
    expect(mocks.findCampaign).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "other", orgId: "org" } }));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
