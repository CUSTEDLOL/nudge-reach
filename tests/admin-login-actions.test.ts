import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClient, signInWithPassword, signOut, redirect } = vi.hoisted(
  () => ({
    createAdminClient: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  })
);

vi.mock("@/lib/supabase/admin-server", () => ({ createAdminClient }));
vi.mock("next/navigation", () => ({ redirect }));

import { loginFounderAction } from "@/app/admin/actions";
import { POST as signOutFounder } from "@/app/admin/signout/route";

const INITIAL_STATE = { ok: false as const, message: "" };
const GENERIC_AUTH_ERROR =
  "Email or password is incorrect, or this account is not authorized.";

function credentials(email = "founder@example.com", password = "secret") {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return formData;
}

describe("loginFounderAction", () => {
  beforeEach(() => {
    process.env.FOUNDER_EMAILS = "founder@example.com";
    createAdminClient.mockReset();
    signInWithPassword.mockReset();
    signOut.mockReset();
    redirect.mockClear();
    createAdminClient.mockResolvedValue({
      auth: { signInWithPassword, signOut },
    });
  });

  it.each([
    { label: "blank values", formData: new FormData() },
    {
      label: "an oversized email",
      formData: credentials(`${"a".repeat(255)}@example.com`),
    },
    {
      label: "an oversized password",
      formData: credentials("founder@example.com", "p".repeat(1025)),
    },
  ])("rejects $label before contacting Supabase", async ({ formData }) => {
    const result = await loginFounderAction(INITIAL_STATE, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/email and password/i);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a generic error for invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid login credentials"),
    });

    const result = await loginFounderAction(INITIAL_STATE, credentials());

    expect(result).toEqual({ ok: false, message: GENERIC_AUTH_ERROR });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "founder@example.com",
      password: "secret",
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("clears an authenticated non-founder admin session", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { email: "customer@example.com" } },
      error: null,
    });

    const result = await loginFounderAction(
      INITIAL_STATE,
      credentials("customer@example.com")
    );

    expect(result).toEqual({ ok: false, message: GENERIC_AUTH_ERROR });
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("clears an allowlisted trial-provenance session instead of granting founder access", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          email: "founder@example.com",
          app_metadata: {
            nudge_account_origin: "instant_trial_v1",
          },
        },
      },
      error: null,
    });

    const result = await loginFounderAction(INITIAL_STATE, credentials());

    expect(result).toEqual({ ok: false, message: GENERIC_AUTH_ERROR });
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects an allowlisted founder into the control room", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { email: "FOUNDER@EXAMPLE.COM" } },
      error: null,
    });

    await expect(
      loginFounderAction(INITIAL_STATE, credentials())
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("does not leak unexpected authentication failures", async () => {
    signInWithPassword.mockRejectedValue(
      new Error("internal connection string and secret")
    );

    const result = await loginFounderAction(INITIAL_STATE, credentials());

    expect(result).toEqual({
      ok: false,
      message: "We couldn't sign you in right now. Please try again.",
    });
    expect(result.message).not.toContain("connection string");
  });
});

describe("POST /admin/signout", () => {
  beforeEach(() => {
    createAdminClient.mockReset();
    signOut.mockReset();
    createAdminClient.mockResolvedValue({ auth: { signOut } });
    signOut.mockResolvedValue({ error: null });
  });

  it("signs out only the isolated admin client and returns to admin login", async () => {
    const response = await signOutFounder(
      new Request("https://nudge.test/admin/signout", { method: "POST" })
    );

    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://nudge.test/admin");
  });
});
