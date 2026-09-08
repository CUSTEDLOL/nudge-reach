import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prisma,
  disconnectWhatsappAccount,
  disconnectCalendar,
  deleteLlmAccount,
  getLlmAccount,
  disconnectCrm,
  revokeApiKey,
} = vi.hoisted(() => ({
  prisma: {
    whatsappAccount: { findFirst: vi.fn() },
    calendarAccount: { findUnique: vi.fn() },
    crmConnection: { findFirst: vi.fn() },
    apiKey: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  disconnectWhatsappAccount: vi.fn(),
  disconnectCalendar: vi.fn(),
  deleteLlmAccount: vi.fn(),
  getLlmAccount: vi.fn(),
  disconnectCrm: vi.fn(),
  revokeApiKey: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/whatsapp/accounts", () => ({
  disconnectWhatsappAccount,
  setDefaultWhatsappAccount: vi.fn(),
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
  founderRevokeApiKey,
} from "@/modules/admin/integrations";

beforeEach(() => {
  vi.clearAllMocks();
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
