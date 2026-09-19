import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The workspace's own "Connect a number" form. Found 2026-09-19 in the
 * pre-launch walkthrough: in live mode it accepted made-up ids and a fake
 * token, showed "Connected" and flipped the workspace live. Only the
 * founder-assisted admin path asked Meta. Inbound messages route by Phone
 * Number ID, so a typo there means the AI never hears a customer.
 */

const { requireOrgContext, validateWhatsappConnection, saveWhatsappAccount, prepareWorkspaceForLive, recordAudit } = vi.hoisted(() => ({
  requireOrgContext: vi.fn(),
  validateWhatsappConnection: vi.fn(),
  saveWhatsappAccount: vi.fn(),
  prepareWorkspaceForLive: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => ({
  requireOrgContext,
  requireRole: (ctx: { role: string }, min: string) => {
    const order: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
    if (order[ctx.role] < order[min]) throw new Error("Only an admin or above can do this.");
  },
}));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit }));
vi.mock("@/modules/orgs/go-live", () => ({ prepareWorkspaceForLive }));
vi.mock("@/modules/whatsapp/connection-validator", () => ({ validateWhatsappConnection }));
vi.mock("@/modules/whatsapp/accounts", () => ({
  saveWhatsappAccount,
  setDefaultWhatsappAccount: vi.fn(),
  disconnectWhatsappAccount: vi.fn(),
}));

import { connectWhatsappAction } from "@/app/(app)/settings/whatsapp/actions";

const form = (over: Record<string, string> = {}) => {
  const fd = new FormData();
  const fields = { displayName: "Aster Clinic", wabaId: "3064885677036509", phoneNumberId: "1229329206928207", accessToken: "EAAG-real-token", ...over };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  requireOrgContext.mockResolvedValue({ role: "OWNER", org: { id: "org1" } });
  saveWhatsappAccount.mockResolvedValue({ ok: true, account: { id: "wa1" } });
  prepareWorkspaceForLive.mockResolvedValue({ testCalendarRemoved: false, templatesSubmitted: 0, templatesRefused: 0 });
});

describe("connectWhatsappAction", () => {
  it("saves nothing when Meta does not recognise the number", async () => {
    validateWhatsappConnection.mockResolvedValue({
      ok: false,
      message: "That Phone Number ID is not registered under this WhatsApp Business Account.",
    });
    const r = await connectWhatsappAction(form());
    expect(r).toEqual({ ok: false, message: "That Phone Number ID is not registered under this WhatsApp Business Account." });
    expect(saveWhatsappAccount).not.toHaveBeenCalled();
    expect(prepareWorkspaceForLive).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("saves the values Meta confirmed, then prepares the workspace for live", async () => {
    validateWhatsappConnection.mockResolvedValue({
      ok: true,
      value: { displayName: "Aster Clinic", wabaId: "3064885677036509", phoneNumberId: "1229329206928207", accessToken: "EAAG-real-token" },
    });
    prepareWorkspaceForLive.mockResolvedValue({ testCalendarRemoved: true, templatesSubmitted: 6, templatesRefused: 0 });
    const r = await connectWhatsappAction(form({ wabaId: " 3064885677036509 " }));
    expect(r.ok).toBe(true);
    expect(saveWhatsappAccount).toHaveBeenCalledWith({
      orgId: "org1",
      displayName: "Aster Clinic",
      wabaId: "3064885677036509",
      phoneNumberId: "1229329206928207",
      accessToken: "EAAG-real-token",
    });
    expect(prepareWorkspaceForLive).toHaveBeenCalledWith("org1");
    expect(r.message).toMatch(/6 message templates sent to Meta/);
  });

  it("refuses an AGENT before it talks to Meta at all", async () => {
    requireOrgContext.mockResolvedValue({ role: "AGENT", org: { id: "org1" } });
    const r = await connectWhatsappAction(form());
    expect(r.ok).toBe(false);
    expect(validateWhatsappConnection).not.toHaveBeenCalled();
    expect(saveWhatsappAccount).not.toHaveBeenCalled();
  });
});
