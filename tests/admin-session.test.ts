import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, cookieGetAll, cookieSet, cookies } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookieGetAll: vi.fn(() => [{ name: "existing", value: "cookie" }]),
  cookieSet: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({ cookies }));

import { createAdminClient } from "@/lib/supabase/admin-server";

type CookieAdapter = {
  getAll(): Array<{ name: string; value: string }>;
  setAll(
    values: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }>
  ): void;
};

describe("createAdminClient", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    createServerClient.mockReset();
    createServerClient.mockReturnValue({ auth: {} });
    cookieGetAll.mockClear();
    cookieSet.mockClear();
    cookies.mockReset();
    cookies.mockResolvedValue({ getAll: cookieGetAll, set: cookieSet });
  });

  it("uses a separate secure cookie scoped to the admin portal", async () => {
    await createAdminClient();

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
      expect.objectContaining({
        cookieOptions: {
          name: "nudge-founder-auth",
          path: "/admin",
          httpOnly: true,
          sameSite: "lax",
          secure: false,
        },
      })
    );
  });

  it("adapts Next cookies without losing Supabase write options", async () => {
    await createAdminClient();
    const options = createServerClient.mock.calls[0]?.[2] as {
      cookies: CookieAdapter;
    };

    expect(options.cookies.getAll()).toEqual([
      { name: "existing", value: "cookie" },
    ]);

    options.cookies.setAll([
      {
        name: "nudge-founder-auth",
        value: "session",
        options: { maxAge: 3600, path: "/admin" },
      },
    ]);

    expect(cookieSet).toHaveBeenCalledWith(
      "nudge-founder-auth",
      "session",
      { maxAge: 3600, path: "/admin" }
    );
  });
});
