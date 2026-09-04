import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E1: resolveApiKeyOrg is the single doorway to /api/v1. It must return JSON
 * error results (never redirect), enforce the publicApi plan flag, and rate-
 * limit per key.
 */

const { verifyApiKey, orgFindUnique } = vi.hoisted(() => ({
  verifyApiKey: vi.fn(),
  orgFindUnique: vi.fn(),
}));

vi.mock("@/modules/integrations/api-keys", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  verifyApiKey,
}));
vi.mock("@/lib/db", () => ({ prisma: { org: { findUnique: orgFindUnique } } }));

import { resolveApiKeyOrg, API_RATE_LIMIT } from "@/modules/integrations/api-auth";

const req = (auth?: string) =>
  new Request("https://nudgeagent.app/api/v1/contacts", {
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  verifyApiKey.mockReset();
  orgFindUnique.mockReset();
});

describe("resolveApiKeyOrg", () => {
  it("401s a missing or malformed Authorization header", async () => {
    for (const r of [req(), req("Basic abc"), req("Bearer wrong_prefix")]) {
      const out = await resolveApiKeyOrg(r);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.response.status).toBe(401);
    }
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  it("401s an unknown or revoked key", async () => {
    verifyApiKey.mockResolvedValue(null);
    const out = await resolveApiKeyOrg(req("Bearer nk_live_deadbeefdeadbeefdead"));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(401);
  });

  it("403s a plan without publicApi, naming the tier to upgrade to", async () => {
    verifyApiKey.mockResolvedValue({ id: "k1", orgId: "org1" });
    orgFindUnique.mockResolvedValue({ id: "org1", name: "Shop", plan: "starter" });
    const out = await resolveApiKeyOrg(req("Bearer nk_live_deadbeefdeadbeefdead"));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.response.status).toBe(403);
      expect(await out.response.text()).toContain("Growth");
    }
  });

  it("returns the org for a valid key on an allowed plan", async () => {
    verifyApiKey.mockResolvedValue({ id: "k-ok", orgId: "org1" });
    orgFindUnique.mockResolvedValue({ id: "org1", name: "Shop", plan: "growth" });
    const out = await resolveApiKeyOrg(req("Bearer nk_live_deadbeefdeadbeefdead"));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.org.id).toBe("org1");
  });

  it("429s once a key exceeds the per-minute limit", async () => {
    verifyApiKey.mockResolvedValue({ id: "k-burst", orgId: "org1" });
    orgFindUnique.mockResolvedValue({ id: "org1", name: "Shop", plan: "growth" });
    let limited = null;
    for (let i = 0; i <= API_RATE_LIMIT.limit; i++) {
      const out = await resolveApiKeyOrg(req("Bearer nk_live_deadbeefdeadbeefdead"));
      if (!out.ok) limited = out.response;
    }
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    expect(limited!.headers.get("Retry-After")).toBeTruthy();
  });
});
