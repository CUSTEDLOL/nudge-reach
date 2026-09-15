import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeOwnerSetup, createClient, signInWithPassword, redirect } = vi.hoisted(
  () => ({
    completeOwnerSetup: vi.fn(),
    createClient: vi.fn(),
    signInWithPassword: vi.fn(),
    redirect: vi.fn(() => {
      throw new Error("NEXT_REDIRECT");
    }),
  })
);

vi.mock("@/modules/orgs/owner-setup", () => ({
  completeOwnerSetup,
  validateOwnerPassword: (password: string, confirmation: string) => {
    if (!password) return "Enter a password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmation) return "The passwords do not match.";
    return null;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/navigation", () => ({ redirect }));

import {
  completeOwnerSetupAction,
  type OwnerSetupActionState,
} from "@/app/invite/[token]/actions";

const INITIAL: OwnerSetupActionState = { status: "idle", message: "" };

function form(password = "safe-password", confirmation = password) {
  const data = new FormData();
  data.set("token", "a".repeat(43));
  data.set("password", password);
  data.set("passwordConfirmation", confirmation);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({ auth: { signInWithPassword } });
  signInWithPassword.mockResolvedValue({ data: {}, error: null });
  completeOwnerSetup.mockResolvedValue({
    ok: true,
    email: "owner@aster.test",
    orgId: "org_1",
  });
});

describe("completeOwnerSetupAction", () => {
  it("rejects blank, short, mismatched, and missing-token submissions before auth", async () => {
    for (const data of [form("", ""), form("short"), form("safe-password", "different")]) {
      const result = await completeOwnerSetupAction(INITIAL, data);
      expect(result.status).toBe("error");
    }
    const missingToken = form();
    missingToken.delete("token");
    expect((await completeOwnerSetupAction(INITIAL, missingToken)).status).toBe("error");
    expect(completeOwnerSetup).not.toHaveBeenCalled();
  });

  it("returns the safe existing-account state without replacing its password", async () => {
    completeOwnerSetup.mockResolvedValue({
      ok: false,
      code: "existing_account",
      message: "An account already exists for this email. Sign in to accept the workspace invite.",
    });

    const result = await completeOwnerSetupAction(INITIAL, form());

    expect(result.status).toBe("existing_account");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("signs the new owner into the normal client session and opens onboarding", async () => {
    await expect(completeOwnerSetupAction(INITIAL, form())).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@aster.test",
      password: "safe-password",
    });
    expect(redirect).toHaveBeenCalledWith("/onboarding");
  });

  it("gives a recoverable sign-in path if browser session creation fails", async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error("cookie failure"),
    });

    const result = await completeOwnerSetupAction(INITIAL, form());

    expect(result).toEqual({
      status: "account_created",
      message: "Your account is ready, but we couldn't sign you in automatically. Sign in to continue.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
