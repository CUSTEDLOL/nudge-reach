import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getClaims } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { isPublicPath, updateSession } from "@/lib/supabase/proxy-session";

function request(path: string, headers?: HeadersInit) {
  return new NextRequest(`https://nudge.test${path}`, { headers });
}

describe("updateSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    createServerClient.mockReset();
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: { claims: null } });
    createServerClient.mockReturnValue({ auth: { getClaims } });
  });

  it("keeps trial signup public while protecting trial setup", () => {
    expect(isPublicPath("/api/trials")).toBe(true);
    expect(isPublicPath("/free-trial")).toBe(true);
    expect(isPublicPath("/trial/setup")).toBe(false);
  });

  it("overwrites any incoming pathname hint with the trusted request path", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { email: "owner@example.com" } },
    });

    const response = await updateSession(
      request("/campaigns", { "x-nudge-pathname": "/dashboard" }),
    );

    expect(response.headers.get("x-middleware-request-x-nudge-pathname")).toBe(
      "/campaigns",
    );
  });

  it("keeps refreshed auth cookies when adding the trusted pathname", async () => {
    createServerClient.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: (values: Array<{ name: string; value: string; options: object }>) => void } }) => ({
        auth: {
          getClaims: async () => {
            options.cookies.setAll([
              { name: "sb-session", value: "fresh-token", options: {} },
            ]);
            return { data: { claims: { email: "owner@example.com" } } };
          },
        },
      }),
    );

    const response = await updateSession(
      request("/dashboard", { cookie: "existing=value" }),
    );

    expect(response.headers.get("x-middleware-request-cookie")).toContain(
      "sb-session=fresh-token",
    );
    expect(response.headers.get("x-middleware-request-x-nudge-pathname")).toBe(
      "/dashboard",
    );
  });

  it.each(["/admin", "/admin/orgs"])(
    "refreshes only the isolated admin session for %s",
    async (path) => {
      const response = await updateSession(request(path));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(getClaims).toHaveBeenCalledOnce();
      expect(createServerClient).toHaveBeenCalledOnce();
      expect(createServerClient.mock.calls[0]?.[2]).toEqual(
        expect.objectContaining({
          cookieOptions: expect.objectContaining({
            name: "nudge-founder-auth",
            path: "/admin",
          }),
        })
      );
    }
  );

  it("retains the normal login redirect for a signed-out app request", async () => {
    const response = await updateSession(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://nudge.test/login");
    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createServerClient.mock.calls[0]?.[2]).not.toHaveProperty(
      "cookieOptions"
    );
  });

  it("lets a signed-out invited owner open the public password setup route", async () => {
    const response = await updateSession(
      request("/invite/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("retains normal authenticated application access", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { email: "owner@example.com" } },
    });

    const response = await updateSession(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(createServerClient.mock.calls[0]?.[2]).not.toHaveProperty(
      "cookieOptions"
    );
  });
});
