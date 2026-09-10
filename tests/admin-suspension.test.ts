import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Founder suspension is enforced at the lowest layer: sendMessage refuses
 * every outbound message for a suspended org, whatever called it.
 */
const { isOrgSuspended, orgSendMode } = vi.hoisted(() => ({
  isOrgSuspended: vi.fn(),
  orgSendMode: vi.fn().mockResolvedValue("simulation"),
}));
vi.mock("@/modules/orgs/mode", () => ({
  isOrgSuspended,
  orgSendMode,
  sendModeFor: () => "simulation",
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({
  dispatchWebhook: vi.fn(),
}));

import { sendMessage } from "@/modules/messaging";

const recipient = {
  address: "+919999999999",
  optedIn: true,
  optedOutAt: null,
};
const payload = { kind: "text" as const, text: "hello" };

beforeEach(() => vi.clearAllMocks());

describe("sendMessage × suspension", () => {
  it("refuses to send for a suspended org", async () => {
    isOrgSuspended.mockResolvedValue(true);
    const res = await sendMessage("whatsapp", recipient, payload, { orgId: "org_1" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/suspended/i);
  });

  it("sends normally when the org is not suspended", async () => {
    isOrgSuspended.mockResolvedValue(false);
    const res = await sendMessage("whatsapp", recipient, payload, { orgId: "org_1" });
    expect(res.ok).toBe(true);
  });

  it("does not look up suspension for org-less sends", async () => {
    const res = await sendMessage("whatsapp", recipient, payload);
    expect(res.ok).toBe(true);
    expect(isOrgSuspended).not.toHaveBeenCalled();
  });
});
