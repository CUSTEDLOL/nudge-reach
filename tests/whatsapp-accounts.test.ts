import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E4 multi-number account rules:
 *  - a second number requires the multiNumber plan flag
 *  - a number already claimed by ANOTHER org is refused (webhook routing key)
 *  - default resolution: isDefault else oldest; disconnecting the default
 *    promotes the oldest survivor
 *  - back-compat: getWhatsappCredentials(orgId) = the default account
 */

const { prisma, transactionDb } = vi.hoisted(() => ({
  prisma: {
    org: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn() },
    whatsappAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  },
  transactionDb: {
    org: { update: vi.fn().mockResolvedValue({}) },
    whatsappAccount: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/env", () => ({
  env: { TOKEN_ENCRYPTION_KEY: "k".repeat(32), SEND_MODE: "simulation" },
}));

import { encryptSecret } from "@/lib/crypto";
import {
  saveWhatsappAccount,
  getWhatsappCredentials,
  disconnectWhatsappAccount,
} from "@/modules/whatsapp/accounts";

const INPUT = {
  orgId: "org1",
  wabaId: "waba1",
  phoneNumberId: "pn-100",
  displayName: "Delhi clinic",
  accessToken: "tok",
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.whatsappAccount.upsert.mockResolvedValue({ id: "wa1" });
  transactionDb.whatsappAccount.upsert.mockResolvedValue({ id: "wa1" });
});

describe("saveWhatsappAccount", () => {
  it("first number needs no plan flag and becomes the default", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(0);
    const r = await saveWhatsappAccount(INPUT);
    expect(r.ok).toBe(true);
    const args = prisma.whatsappAccount.upsert.mock.calls[0][0];
    expect(args.create.isDefault).toBe(true);
  });

  it("a SECOND number is refused once the plan's number cap is reached", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(1);
    // Starter includes exactly one number.
    prisma.org.findUnique.mockResolvedValue({ plan: "starter" });
    const r = await saveWhatsappAccount({ ...INPUT, phoneNumberId: "pn-200" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/1 WhatsApp number|Upgrade to Growth/i);
    expect(prisma.whatsappAccount.upsert).not.toHaveBeenCalled();
  });

  it("a second number saves fine on Growth, whose cap is two", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(1);
    prisma.org.findUnique.mockResolvedValue({ plan: "growth" });
    const r = await saveWhatsappAccount({ ...INPUT, phoneNumberId: "pn-200" });
    expect(r.ok).toBe(true);
  });

  it("a THIRD number is refused on Growth", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(2);
    prisma.org.findUnique.mockResolvedValue({ plan: "growth" });
    const r = await saveWhatsappAccount({ ...INPUT, phoneNumberId: "pn-300" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/2 WhatsApp numbers|Upgrade to Pro/i);
  });

  it("a second number saves fine on an enterprise plan", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(1);
    prisma.org.findUnique.mockResolvedValue({ plan: "enterprise" });
    const r = await saveWhatsappAccount({ ...INPUT, phoneNumberId: "pn-200" });
    expect(r.ok).toBe(true);
    expect(prisma.whatsappAccount.upsert.mock.calls[0][0].create.isDefault).toBe(false);
  });

  it("refuses a phone number already connected to another org", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue({
      id: "other",
      orgId: "someone-else",
    });
    const r = await saveWhatsappAccount(INPUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("another workspace");
    expect(prisma.whatsappAccount.upsert).not.toHaveBeenCalled();
  });

  it("re-entering the org's own number updates it without a plan check", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue({ id: "wa1", orgId: "org1" });
    prisma.whatsappAccount.count.mockResolvedValue(1);
    const r = await saveWhatsappAccount(INPUT);
    expect(r.ok).toBe(true);
    expect(prisma.org.findUnique).not.toHaveBeenCalled(); // no gate consulted
  });

  it("never changes the org's send mode, on any path", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(0);

    const r = await saveWhatsappAccount(INPUT);

    expect(r.ok).toBe(true);
    expect(prisma.whatsappAccount.upsert).toHaveBeenCalledOnce();
    expect(prisma.org.update).not.toHaveBeenCalled();
  });

  it("can persist through a caller-provided transaction client", async () => {
    transactionDb.whatsappAccount.findUnique.mockResolvedValue(null);
    transactionDb.whatsappAccount.count.mockResolvedValue(0);

    const r = await saveWhatsappAccount(INPUT, { db: transactionDb });

    expect(r.ok).toBe(true);
    expect(transactionDb.whatsappAccount.upsert).toHaveBeenCalledOnce();
    expect(prisma.whatsappAccount.upsert).not.toHaveBeenCalled();
  });
});

describe("credentials resolution", () => {
  it("without an account id, returns the default account's credentials", async () => {
    prisma.whatsappAccount.findFirst.mockResolvedValue({
      wabaId: "waba1",
      phoneNumberId: "pn-100",
      accessTokenEncrypted: encryptSecret("tok"),
    });
    const creds = await getWhatsappCredentials("org1");
    expect(creds?.phoneNumberId).toBe("pn-100");
    expect(creds?.accessToken).toBe("tok");
    // Resolution ordered default-first.
    const q = prisma.whatsappAccount.findFirst.mock.calls[0][0];
    expect(q.orderBy).toEqual([{ isDefault: "desc" }, { createdAt: "asc" }]);
  });

  it("a stale account id falls back to the default so sends survive", async () => {
    prisma.whatsappAccount.findFirst
      .mockResolvedValueOnce(null) // the stale id lookup
      .mockResolvedValueOnce({
        wabaId: "waba1",
        phoneNumberId: "pn-100",
        accessTokenEncrypted: encryptSecret("tok"),
      });
    const creds = await getWhatsappCredentials("org1", "deleted-account");
    expect(creds?.phoneNumberId).toBe("pn-100");
  });
});

describe("disconnectWhatsappAccount", () => {
  it("promotes the oldest survivor when the default is disconnected", async () => {
    prisma.whatsappAccount.findFirst
      .mockResolvedValueOnce({ id: "wa1", orgId: "org1", isDefault: true })
      .mockResolvedValueOnce({ id: "wa2" }); // survivor
    const ok = await disconnectWhatsappAccount("org1", "wa1");
    expect(ok).toBe(true);
    expect(prisma.whatsappAccount.update).toHaveBeenCalledWith({
      where: { id: "wa2" },
      data: { isDefault: true },
    });
  });
});

/**
 * Send mode is a founder control (admin → Controls). Connecting a number used
 * to flip the workspace live as a side effect when the OWNER used the
 * Settings → WhatsApp form, while the founder-assisted path deliberately left
 * it alone. That left the boundary incoherent: an owner could put themselves
 * live by accident but had no way back, because there is no live/test control
 * in the workspace at all.
 *
 * The rule is now single and symmetric: connecting never changes mode, and
 * losing the last number returns the workspace to test — so a "live" workspace
 * can never be left with nothing to send from.
 */
describe("connecting a number never changes send mode", () => {
  const INPUT_ = {
    orgId: "org1",
    wabaId: "1",
    phoneNumberId: "2",
    displayName: "Main",
    accessToken: "tok",
  };

  it("does not flip the workspace live on a first connection", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(0);
    prisma.org.findUnique.mockResolvedValue({ plan: "pro", featureOverrides: {} });

    const r = await saveWhatsappAccount(INPUT_);

    expect(r.ok).toBe(true);
    expect(prisma.whatsappAccount.upsert).toHaveBeenCalledOnce();
    // The founder flips the switch, not the connect form.
    expect(prisma.org.update).not.toHaveBeenCalled();
  });
});

describe("disconnecting the last number returns the workspace to test", () => {
  it("reverts to test mode when no numbers remain", async () => {
    prisma.whatsappAccount.findFirst.mockResolvedValueOnce({
      id: "wa1",
      orgId: "org1",
      isDefault: true,
    });
    // No survivor.
    prisma.whatsappAccount.findFirst.mockResolvedValueOnce(null);
    prisma.whatsappAccount.count.mockResolvedValue(0);

    const ok = await disconnectWhatsappAccount("org1", "wa1");

    expect(ok).toBe(true);
    // A live workspace with no number cannot send at all — production has no
    // fallback sender credentials — so it must not be left claiming "Live".
    expect(prisma.org.update).toHaveBeenCalledWith({
      where: { id: "org1" },
      data: { simulated: true },
    });
  });

  it("leaves mode alone while another number survives", async () => {
    prisma.whatsappAccount.findFirst.mockResolvedValueOnce({
      id: "wa1",
      orgId: "org1",
      isDefault: true,
    });
    prisma.whatsappAccount.findFirst.mockResolvedValueOnce({ id: "wa2", orgId: "org1" });
    prisma.whatsappAccount.count.mockResolvedValue(1);

    const ok = await disconnectWhatsappAccount("org1", "wa1");

    expect(ok).toBe(true);
    expect(prisma.org.update).not.toHaveBeenCalled();
  });
});
