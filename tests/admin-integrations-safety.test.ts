import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  disconnectWhatsappAccount,
  saveWhatsappAccount,
  validateWhatsappConnection,
  disconnectCalendar,
  deleteLlmAccount,
  getLlmAccount,
  disconnectCrm,
  revokeApiKey,
} = vi.hoisted(() => ({
  prisma: {
    org: { findUnique: vi.fn() },
    whatsappAccount: { findFirst: vi.fn() },
    calendarAccount: { findUnique: vi.fn() },
    crmConnection: { findFirst: vi.fn() },
    apiKey: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  disconnectWhatsappAccount: vi.fn(),
  saveWhatsappAccount: vi.fn(),
  validateWhatsappConnection: vi.fn(),
  disconnectCalendar: vi.fn(),
  deleteLlmAccount: vi.fn(),
  getLlmAccount: vi.fn(),
  disconnectCrm: vi.fn(),
  revokeApiKey: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/whatsapp/accounts", () => ({
  disconnectWhatsappAccount,
  saveWhatsappAccount,
  setDefaultWhatsappAccount: vi.fn(),
}));
vi.mock("@/modules/whatsapp/connection-validator", () => ({
  validateWhatsappConnection,
}));
vi.mock("@/modules/calendar/accounts", () => ({ disconnectCalendar }));
vi.mock("@/modules/ai/llm-account", () => ({
  deleteLlmAccount,
  getLlmAccount,
}));
vi.mock("@/modules/crm/connections", () => ({ disconnect: disconnectCrm }));
vi.mock("@/modules/integrations/api-keys", () => ({ revokeApiKey }));
vi.mock("@/modules/voice/usage", () => ({ voiceUsage: vi.fn() }));

import {
  founderDisconnectCalendar,
  founderDisconnectCrm,
  founderDisconnectLlm,
  founderDisconnectNumber,
  founderConnectWhatsapp,
  founderRevokeApiKey,
} from "@/modules/admin/integrations";

const CONNECTION = {
  displayName: "Clinic WhatsApp",
  wabaId: "123456789012345",
  phoneNumberId: "987654321098765",
  accessToken: "EAA-founder-secret-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.org.findUnique.mockResolvedValue({ id: "o1" });
  prisma.whatsappAccount.findFirst.mockResolvedValue({
    displayName: "Clinic WhatsApp",
    phoneNumberId: "pn_123",
  });
  prisma.calendarAccount.findUnique.mockResolvedValue({
    accountEmail: "bookings@clinic.test",
  });
  getLlmAccount.mockResolvedValue({ provider: "anthropic", model: "sonnet" });
  prisma.crmConnection.findFirst.mockResolvedValue({
    id: "crm_1",
    accountLabel: "Clinic Zoho",
  });
  prisma.apiKey.findFirst.mockResolvedValue({
    name: "Website",
    prefix: "ndg_live_12",
    revokedAt: null,
  });
  prisma.auditLog.create.mockResolvedValue({});
  prisma.$transaction.mockImplementation(async (work) => work(prisma));
  validateWhatsappConnection.mockResolvedValue({ ok: true, value: CONNECTION });
  saveWhatsappAccount.mockResolvedValue({ ok: true, account: { id: "wa_1" } });
});

describe("founder WhatsApp connection", () => {
  it("requires a reason before validating or saving", async () => {
    const res = await founderConnectWhatsapp("o1", CONNECTION, "f@nudge.test", "");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/reason/i) });
    expect(validateWhatsappConnection).not.toHaveBeenCalled();
    expect(saveWhatsappAccount).not.toHaveBeenCalled();
  });

  it("rejects a missing target org before contacting Meta", async () => {
    prisma.org.findUnique.mockResolvedValue(null);

    const res = await founderConnectWhatsapp(
      "missing",
      CONNECTION,
      "f@nudge.test",
      "initial client setup"
    );

    expect(res).toEqual({ ok: false, error: "Organization not found." });
    expect(validateWhatsappConnection).not.toHaveBeenCalled();
    expect(saveWhatsappAccount).not.toHaveBeenCalled();
  });

  it("saves and audits nothing when Meta validation fails", async () => {
    validateWhatsappConnection.mockResolvedValue({
      ok: false,
      message: "Meta rejected the access token. Check it and try again.",
    });

    const res = await founderConnectWhatsapp(
      "o1",
      CONNECTION,
      "f@nudge.test",
      "initial client setup"
    );

    expect(res).toEqual({
      ok: false,
      error: "Meta rejected the access token. Check it and try again.",
    });
    expect(saveWhatsappAccount).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("stores validated credentials without changing mode and writes a redacted audit", async () => {
    const res = await founderConnectWhatsapp(
      "o1",
      CONNECTION,
      "f@nudge.test",
      "initial client setup"
    );

    expect(res).toEqual({
      ok: true,
      message: "Clinic WhatsApp connected. Sending mode was not changed.",
    });
    expect(saveWhatsappAccount).toHaveBeenCalledWith(
      { orgId: "o1", ...CONNECTION },
      { activateOrg: false, db: prisma }
    );
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit).toEqual(
      expect.objectContaining({
        orgId: "o1",
        actorName: "founder:f@nudge.test",
        action: "admin.integration_changed",
        target: "WhatsApp Clinic WhatsApp",
      })
    );
    expect(audit.detail).toContain(CONNECTION.wabaId);
    expect(audit.detail).toContain(CONNECTION.phoneNumberId);
    expect(audit.detail).toContain("initial client setup");
    expect(audit.detail).not.toContain(CONNECTION.accessToken);
  });

  it("does not write a success audit when encrypted persistence is refused", async () => {
    saveWhatsappAccount.mockResolvedValue({
      ok: false,
      message: "That phone number is already connected to another workspace.",
    });

    const res = await founderConnectWhatsapp(
      "o1",
      CONNECTION,
      "f@nudge.test",
      "initial client setup"
    );

    expect(res).toEqual({
      ok: false,
      error: "That phone number is already connected to another workspace.",
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("critical integration confirmations", () => {
  it("requires the WhatsApp number label", async () => {
    const res = await founderDisconnectNumber(
      "o1",
      "wa_1",
      "f@nudge.test",
      "owner requested it",
      "wrong number"
    );

    expect(res.ok).toBe(false);
    expect(disconnectWhatsappAccount).not.toHaveBeenCalled();
  });

  it("requires the connected calendar email", async () => {
    const res = await founderDisconnectCalendar(
      "o1",
      "f@nudge.test",
      "owner requested it",
      "wrong@clinic.test"
    );

    expect(res.ok).toBe(false);
    expect(disconnectCalendar).not.toHaveBeenCalled();
  });

  it("requires the LLM provider and model", async () => {
    const res = await founderDisconnectLlm(
      "o1",
      "f@nudge.test",
      "owner requested it",
      "anthropic"
    );

    expect(res.ok).toBe(false);
    expect(deleteLlmAccount).not.toHaveBeenCalled();
  });

  it("requires the CRM provider", async () => {
    const res = await founderDisconnectCrm(
      "o1",
      "zoho",
      "f@nudge.test",
      "owner requested it",
      "salesforce"
    );

    expect(res.ok).toBe(false);
    expect(disconnectCrm).not.toHaveBeenCalled();
  });

  it("requires the API-key prefix", async () => {
    const res = await founderRevokeApiKey(
      "o1",
      "key_1",
      "f@nudge.test",
      "key was exposed",
      "ndg_live_99"
    );

    expect(res.ok).toBe(false);
    expect(revokeApiKey).not.toHaveBeenCalled();
  });

  it("accepts normalized exact confirmation", async () => {
    const res = await founderDisconnectNumber(
      "o1",
      "wa_1",
      "f@nudge.test",
      "owner requested it",
      "  clinic whatsapp "
    );

    expect(res.ok).toBe(true);
    expect(disconnectWhatsappAccount).toHaveBeenCalledWith("o1", "wa_1");
  });
});
