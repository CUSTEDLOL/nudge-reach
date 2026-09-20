import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Try your AI" in a LIVE workspace: the pretend customer gets a +999
 * sandbox number, and sendMessage must route it through the simulation
 * driver no matter what the workspace mode says. This is what makes it safe
 * for a paying client to try the AI before (and after) their number is live.
 */

const { liveSend, simSend, dispatchWebhook } = vi.hoisted(() => ({
  liveSend: vi.fn(async () => ({ ok: true, providerMessageId: "wamid.live" })),
  simSend: vi.fn(async () => ({ ok: true, providerMessageId: "sim-1" })),
  dispatchWebhook: vi.fn(),
}));
vi.mock("@/modules/messaging/drivers/whatsapp-live", () => ({
  WhatsappLiveDriver: class { send = liveSend; },
}));
vi.mock("@/modules/messaging/drivers/whatsapp-simulation", () => ({
  WhatsappSimulationDriver: class { send = simSend; },
}));
vi.mock("@/lib/env", () => ({ env: { SEND_MODE: "live", WHATSAPP_API_VERSION: "v23.0" } }));
vi.mock("@/modules/orgs/mode", () => ({
  isOrgSuspended: vi.fn(async () => false),
  orgSendMode: vi.fn(async () => "live"),
}));
vi.mock("@/modules/whatsapp/accounts", () => ({
  getWhatsappCredentials: vi.fn(async () => ({ phoneNumberId: "p1", accessToken: "t" })),
}));
vi.mock("@/modules/integrations/outbound-webhooks", () => ({ dispatchWebhook }));

import { sendMessage } from "@/modules/messaging";
import { isSandboxAddress, sandboxAddress } from "@/modules/messaging/sandbox";

const text = { kind: "text" as const, text: "hello" };

beforeEach(() => vi.clearAllMocks());

describe("sandbox addresses", () => {
  it("builds an unassignable +999 number from whatever was typed", () => {
    expect(sandboxAddress("9876500001")).toBe("+9999876500001");
    expect(sandboxAddress("+91 98765 00001")).toBe("+999919876500001");
    expect(sandboxAddress("")).toBe("+9991");
    expect(isSandboxAddress("+9999876500001")).toBe(true);
    expect(isSandboxAddress("+919876500001")).toBe(false);
  });

  it("a live workspace still sends real numbers for real", async () => {
    const r = await sendMessage("whatsapp", { address: "+919876500001", optedIn: true, optedOutAt: null }, text, { orgId: "o1" });
    expect(r.ok).toBe(true);
    expect(liveSend).toHaveBeenCalledTimes(1);
    expect(simSend).not.toHaveBeenCalled();
  });

  it("a sandbox number never reaches the live driver, even in a live workspace", async () => {
    const r = await sendMessage("whatsapp", { address: "+9999876500001", optedIn: true, optedOutAt: null }, text, { orgId: "o1" });
    expect(r.ok).toBe(true);
    expect(simSend).toHaveBeenCalledTimes(1);
    expect(liveSend).not.toHaveBeenCalled();
  });

  it("can suppress integration webhooks for a private acquisition-trial reply", async () => {
    await sendMessage(
      "whatsapp",
      { address: "+9999876500001", optedIn: true, optedOutAt: null },
      text,
      { orgId: "o1", suppressWebhook: true },
    );

    expect(simSend).toHaveBeenCalledTimes(1);
    expect(dispatchWebhook).not.toHaveBeenCalled();
  });
});
