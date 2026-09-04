import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E4 multi-number account rules:
 *  - a second number requires the multiNumber plan flag
 *  - a number already claimed by ANOTHER org is refused (webhook routing key)
 *  - default resolution: isDefault else oldest; disconnecting the default
 *    promotes the oldest survivor
 *  - back-compat: getWhatsappCredentials(orgId) = the default account
 */

const { prisma } = vi.hoisted(() => ({
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

  it("a SECOND number is refused on a plan without multiNumber", async () => {
    prisma.whatsappAccount.findUnique.mockResolvedValue(null);
    prisma.whatsappAccount.count.mockResolvedValue(1);
    prisma.org.findUnique.mockResolvedValue({ plan: "growth" }); // checkMultiNumber reads this
    const r = await saveWhatsappAccount({ ...INPUT, phoneNumberId: "pn-200" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/plan|AI Front Desk|Upgrade/i);
    expect(prisma.whatsappAccount.upsert).not.toHaveBeenCalled();
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
