import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClient,
  verifyOtp,
  exchangeCodeForSession,
  markAcquisitionTrialEmailVerified,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  markAcquisitionTrialEmailVerified: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/modules/trial/email-verification", () => ({
  markAcquisitionTrialEmailVerified,
}));

import { GET } from "@/app/auth/confirm/route";

const user = {
  id: "user_1",
  aud: "authenticated",
  role: "authenticated",
  email: "Owner@Example.COM",
  email_confirmed_at: "2026-09-22T10:00:00.000Z",
  phone: "",
  confirmed_at: "2026-09-22T10:00:00.000Z",
  last_sign_in_at: "2026-09-22T10:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-09-22T09:00:00.000Z",
  updated_at: "2026-09-22T10:00:00.000Z",
  is_anonymous: false,
};

function successfulAuth(authoritativeUser: typeof user | null = user) {
  return {
    data: { user: authoritativeUser, session: null },
    error: null,
  };
}

function request(query: string) {
  return new Request(`https://nudge.test/auth/confirm?${query}`);
}

describe("auth confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockResolvedValue({
      auth: { verifyOtp, exchangeCodeForSession },
    });
    markAcquisitionTrialEmailVerified.mockResolvedValue(true);
  });

  it("marks a valid magic link from the authoritative user and redirects safely", async () => {
    verifyOtp.mockResolvedValue(successfulAuth());

    const response = await GET(
      request("token_hash=otp_hash&type=magiclink&next=%2Fagent"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "magiclink",
      token_hash: "otp_hash",
    });
    expect(markAcquisitionTrialEmailVerified).toHaveBeenCalledWith({
      userId: "user_1",
      email: "Owner@Example.COM",
    });
    expect(response.headers.get("location")).toBe("https://nudge.test/agent");
  });

  it("marks a valid PKCE exchange from the authoritative user", async () => {
    exchangeCodeForSession.mockResolvedValue(successfulAuth());

    const response = await GET(request("code=pkce_code&next=%2Fdashboard"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce_code");
    expect(markAcquisitionTrialEmailVerified).toHaveBeenCalledWith({
      userId: "user_1",
      email: "Owner@Example.COM",
    });
    expect(response.headers.get("location")).toBe(
      "https://nudge.test/dashboard",
    );
  });

  it("does not mark an invalid or expired magic link", async () => {
    verifyOtp.mockResolvedValue({
      data: { user, session: null },
      error: { message: "Token has expired" },
    });

    const response = await GET(
      request("token_hash=expired&type=magiclink&next=%2Fdashboard"),
    );

    expect(markAcquisitionTrialEmailVerified).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://nudge.test/login?error=confirm",
    );
  });

  it.each([
    ["no returned user", null],
    ["no returned email", { ...user, email: undefined }],
  ])("does not mark a successful exchange with %s", async (_label, authUser) => {
    verifyOtp.mockResolvedValue(successfulAuth(authUser as typeof user | null));

    const response = await GET(
      request("token_hash=otp_hash&type=magiclink&next=%2Fdashboard"),
    );

    expect(markAcquisitionTrialEmailVerified).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://nudge.test/dashboard",
    );
  });

  it("does not mark a failed PKCE exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user, session: null },
      error: { message: "Invalid code" },
    });

    const response = await GET(request("code=bad_code&next=%2Fdashboard"));

    expect(markAcquisitionTrialEmailVerified).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://nudge.test/login?error=confirm",
    );
  });

  it("contains marker failure and rejects an attacker-controlled redirect", async () => {
    verifyOtp.mockResolvedValue(successfulAuth());
    markAcquisitionTrialEmailVerified.mockRejectedValue(
      new Error("database unavailable"),
    );

    const response = await GET(
      request("token_hash=otp_hash&type=magiclink&next=https://evil.test"),
    );

    expect(markAcquisitionTrialEmailVerified).toHaveBeenCalledWith({
      userId: "user_1",
      email: "Owner@Example.COM",
    });
    expect(response.headers.get("location")).toBe(
      "https://nudge.test/dashboard",
    );
  });
});
