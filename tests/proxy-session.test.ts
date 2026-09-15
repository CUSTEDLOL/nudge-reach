import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient, getClaims } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "@/lib/supabase/proxy-session";

function request(path: string) {
  return new NextRequest(`https://nudge.test${path}`);
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
