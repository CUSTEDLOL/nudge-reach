import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E1 POST /api/v1/contacts — invariant 2: an API upsert of an existing
 * contact must NEVER touch consent fields (no opt-out resurrection), and
 * opt-in on create requires the explicit flag.
 */

const { prisma, checkContactLimit } = vi.hoisted(() => ({
  prisma: {
    contact: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  },
  checkContactLimit: vi.fn().mockResolvedValue({ allowed: true, message: "" }),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/modules/billing/limits", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkContactLimit,
}));
vi.mock("@/modules/automation/triggers", () => ({
  fireContactCreated: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/contacts/events", () => ({ recordContactEvent: vi.fn() }));
vi.mock("@/modules/integrations/api-auth", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveApiKeyOrg: vi.fn().mockResolvedValue({
    ok: true,
    org: { id: "org1", plan: "growth", dialCode: "+91" },
    apiKeyId: "k1",
  }),
}));

import { POST } from "@/app/api/v1/contacts/route";

const ROW = {
  id: "c1",
  name: "Priya",
  phoneE164: "+919876543210",
  email: null,
  leadStage: "NEW",
  optedIn: false,
  optedOutAt: new Date("2026-01-01"),
  lastContactedAt: null,
  createdAt: new Date(),
};

const post = (body: object) =>
  POST(
    new Request("https://x/api/v1/contacts", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { authorization: "Bearer nk_live_test" },
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  checkContactLimit.mockResolvedValue({ allowed: true, message: "" });
  prisma.contact.upsert.mockResolvedValue(ROW);
});

describe("POST /api/v1/contacts — consent (invariant 2)", () => {
  it("updating an existing opted-out contact never touches consent fields", async () => {
    prisma.contact.findUnique.mockResolvedValue({ id: "c1" }); // exists
    const res = await post({ name: "Priya", phone: "9876543210", opt_in: true });
    expect(res.status).toBe(200);
    const { update } = prisma.contact.upsert.mock.calls[0][0] as {
      update: Record<string, unknown>;
    };
    expect(update).not.toHaveProperty("optedIn");
    expect(update).not.toHaveProperty("optedOutAt");
    expect(update).not.toHaveProperty("optInSource");
  });

  it("creates opted-out-by-default unless opt_in is explicitly true", async () => {
    prisma.contact.findUnique.mockResolvedValue(null);
    await post({ name: "New", phone: "9876500000" });
    const { create } = prisma.contact.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
    };
    expect(create.optedIn).toBe(false);
  });

  it("respects the plan's contact limit for genuinely new contacts", async () => {
    prisma.contact.findUnique.mockResolvedValue(null);
    checkContactLimit.mockResolvedValue({ allowed: false, message: "limit reached — Upgrade" });
    const res = await post({ name: "New", phone: "9876500000" });
    expect(res.status).toBe(403);
    expect(prisma.contact.upsert).not.toHaveBeenCalled();
  });

  it("422s a garbage phone", async () => {
    const res = await post({ name: "X", phone: "not-a-phone" });
    expect(res.status).toBe(422);
  });
});
