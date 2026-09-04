import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E0: API keys + outbound webhooks are a Growth+ feature (publicApi flag).
 * The two CREATE actions must be plan-gated; revoke/toggle/delete stay
 * ungated so a downgraded org can clean up.
 */

const { requireOrgContext, orgFindUnique, createApiKey, webhookCreate } =
  vi.hoisted(() => ({
    requireOrgContext: vi.fn(),
    orgFindUnique: vi.fn(),
    createApiKey: vi.fn().mockResolvedValue({ key: "nk_live_test", id: "k1" }),
    webhookCreate: vi.fn().mockResolvedValue({ id: "w1" }),
  }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    org: { findUnique: orgFindUnique },
    webhookEndpoint: { create: webhookCreate },
  },
}));
vi.mock("@/modules/integrations/api-keys", () => ({
  createApiKey,
  revokeApiKey: vi.fn(),
}));
vi.mock("@/modules/orgs/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/modules/orgs/auth", () => {
  const ORDER: Record<string, number> = { OWNER: 3, ADMIN: 2, AGENT: 1 };
  return {
    requireOrgContext,
    requireRole: (ctx: { role: string }, min: string) => {
      if (ORDER[ctx.role] < ORDER[min]) {
        throw new Error("Only an admin or above can do this.");
      }
    },
  };
});

import {
  createApiKeyAction,
  createWebhookEndpointAction,
} from "@/app/(app)/integrations/actions";

const form = (f: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v)) for (const item of v) fd.append(k, item);
    else fd.set(k, v);
  }
  return fd;
};

const adminCtx = {
  role: "ADMIN",
  org: { id: "org1" },
  userId: "u1",
  email: "e@x.com",
  membership: {},
};

beforeEach(() => {
  requireOrgContext.mockReset();
  requireOrgContext.mockResolvedValue(adminCtx);
  orgFindUnique.mockReset();
  createApiKey.mockClear();
  webhookCreate.mockClear();
});

const onPlan = (plan: string) => orgFindUnique.mockResolvedValue({ plan });

describe("createApiKeyAction — publicApi plan gate", () => {
  it("refuses a Starter org with an upsell naming Growth, and mints nothing", async () => {
    onPlan("starter");
    const r = await createApiKeyAction(form({ name: "Zapier" }));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Growth");
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("lets a Growth org through to key creation", async () => {
    onPlan("growth");
    const r = await createApiKeyAction(form({ name: "Zapier" }));
    expect(r.ok).toBe(true);
    expect(createApiKey).toHaveBeenCalledWith("org1", "Zapier");
  });
});

describe("createWebhookEndpointAction — publicApi plan gate", () => {
  it("refuses a free org and creates no endpoint", async () => {
    onPlan("free");
    const r = await createWebhookEndpointAction(
      form({ url: "https://example.com/hook", events: ["message.received"] })
    );
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Growth");
    expect(webhookCreate).not.toHaveBeenCalled();
  });

  it("lets a Growth org create an endpoint", async () => {
    onPlan("growth");
    const r = await createWebhookEndpointAction(
      form({ url: "https://example.com/hook", events: ["message.received"] })
    );
    expect(r.ok).toBe(true);
    expect(webhookCreate).toHaveBeenCalled();
  });
});
