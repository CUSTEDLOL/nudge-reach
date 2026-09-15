import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClient,
  createDefaultClient,
  getClaims,
  redirect,
  notFound,
} = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createDefaultClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/supabase/admin-server", () => ({ createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: createDefaultClient,
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import {
  getFounderContext,
  isFounderEmail,
  requireFounder,
} from "@/modules/admin/auth";

/**
 * Founder-panel gate (docs/plans/2026-09-05-admin-panel.md). The rule that
 * matters most: with no FOUNDER_EMAILS configured the panel is OFF for
 * everyone — it fails closed, never open.
 */
describe("isFounderEmail", () => {
  const LIST = "vishesh@example.com, Dhairya@Example.com";

  it("fails closed when the allowlist is unset or empty", () => {
    expect(isFounderEmail("vishesh@example.com", undefined)).toBe(false);
    expect(isFounderEmail("vishesh@example.com", "")).toBe(false);
    expect(isFounderEmail("vishesh@example.com", "  ,  ,")).toBe(false);
  });

  it("matches listed emails case-insensitively, ignoring whitespace", () => {
    expect(isFounderEmail("vishesh@example.com", LIST)).toBe(true);
    expect(isFounderEmail("VISHESH@EXAMPLE.COM", LIST)).toBe(true);
    expect(isFounderEmail("dhairya@example.com", LIST)).toBe(true);
  });

  it("rejects everyone else, including near-misses and empty emails", () => {
    expect(isFounderEmail("customer@example.com", LIST)).toBe(false);
    expect(isFounderEmail("vishesh@example.co", LIST)).toBe(false);
    expect(isFounderEmail("", LIST)).toBe(false);
    expect(isFounderEmail(undefined, LIST)).toBe(false);
  });
});

describe("founder session gate", () => {
  beforeEach(() => {
    process.env.FOUNDER_EMAILS = "founder@example.com";
    getClaims.mockReset();
    createAdminClient.mockReset();
    createDefaultClient.mockReset();
    redirect.mockClear();
    notFound.mockClear();
    createAdminClient.mockResolvedValue({ auth: { getClaims } });
    createDefaultClient.mockResolvedValue({ auth: { getClaims } });
  });

  it("returns a normalized founder from the isolated admin claims", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { email: " FOUNDER@EXAMPLE.COM " } },
    });

    await expect(getFounderContext()).resolves.toEqual({
      email: "founder@example.com",
    });
    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(createDefaultClient).not.toHaveBeenCalled();
  });

  it.each([
    { claims: undefined, label: "a missing admin session" },
    {
      claims: { email: "customer@example.com" },
      label: "a signed-in non-founder",
    },
  ])("returns null for $label", async ({ claims }) => {
    getClaims.mockResolvedValue({ data: { claims } });

    await expect(getFounderContext()).resolves.toBeNull();
  });

  it("returns the founder from the required gate", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { email: "founder@example.com" } },
    });

    await expect(requireFounder()).resolves.toEqual({
      email: "founder@example.com",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an unauthorized admin session to the stable login entry", async () => {
    getClaims.mockResolvedValue({ data: { claims: undefined } });

    await expect(requireFounder()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin");
    expect(notFound).not.toHaveBeenCalled();
  });
});
