import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  acquisitionTrialFindFirst,
  checkRateLimit,
  createServiceRoleClient,
  createUser,
} = vi.hoisted(() => ({
  acquisitionTrialFindFirst: vi.fn(),
  checkRateLimit: vi.fn(),
  createServiceRoleClient: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    acquisitionTrial: { findFirst: acquisitionTrialFindFirst },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMITS: { publicForm: { limit: 5, windowMs: 60_000 } },
}));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient }));

import { POST } from "@/app/api/trials/account/route";
import {
  provisionTrialAccount,
  trialAccountSchema,
} from "@/modules/trial/account";
import { hashClaimToken } from "@/modules/trial/signup";

const valid = {
  trialId: "trial_1",
  claimToken: "c".repeat(43),
  password: "correct horse battery staple",
};
const now = new Date("2026-09-22T00:00:00.000Z");

function activeTrial(overrides: Record<string, unknown> = {}) {
  return {
    emailNormalized: "owner@example.com",
    claimTokenHash: hashClaimToken(valid.claimToken),
    ...overrides,
  };
}

function accountRequest(
  body: unknown = valid,
  cookie: string | undefined = valid.claimToken,
  headers: HeadersInit = {},
) {
  return new Request("https://nudge.test/api/trials/account", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie === undefined
        ? {}
        : { cookie: `nudge_trial_resume=${encodeURIComponent(cookie)}` }),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("trial account provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    acquisitionTrialFindFirst.mockResolvedValue(activeTrial());
    createServiceRoleClient.mockReturnValue({
      auth: { admin: { createUser } },
    });
    createUser.mockResolvedValue({
      data: { user: { id: "auth_user_1" } },
      error: null,
    });
  });

  it.each([
    [{ ...valid, trialId: "bad id" }, undefined],
    [{ ...valid, claimToken: "short" }, valid.claimToken],
    [{ ...valid, password: "short" }, valid.claimToken],
    [valid, undefined],
    [valid, "wrong-cookie"],
  ])("rejects invalid or mismatched claims before privileged auth", async (raw, cookie) => {
    await expect(provisionTrialAccount(raw, cookie, now)).resolves.toEqual({
      ok: false,
      code: "invalid",
    });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("uses strict bounded request validation", () => {
    expect(trialAccountSchema.safeParse({ ...valid, unexpected: true }).success)
      .toBe(false);
    expect(trialAccountSchema.safeParse({
      ...valid,
      password: "p".repeat(129),
    }).success).toBe(false);
    expect(trialAccountSchema.safeParse({
      ...valid,
      claimToken: "c".repeat(129),
    }).success).toBe(false);
  });

  it("looks up only the exact unclaimed and unexpired trial", async () => {
    await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
      .toEqual({ ok: true });

    expect(acquisitionTrialFindFirst).toHaveBeenCalledWith({
      where: {
        id: valid.trialId,
        claimTokenHash: hashClaimToken(valid.claimToken),
        claimedAt: null,
        claimExpiresAt: { gt: now },
      },
      select: {
        emailNormalized: true,
        claimTokenHash: true,
      },
    });
  });

  it.each(["expired", "already claimed"])(
    "rejects an %s trial before privileged auth",
    async () => {
      acquisitionTrialFindFirst.mockResolvedValue(null);

      await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
        .toEqual({ ok: false, code: "invalid" });
      expect(createServiceRoleClient).not.toHaveBeenCalled();
    },
  );

  it("rejects a forged stored hash before privileged auth", async () => {
    acquisitionTrialFindFirst.mockResolvedValue(activeTrial({
      claimTokenHash: hashClaimToken("f".repeat(43)),
    }));

    await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
      .toEqual({ ok: false, code: "invalid" });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("creates the password user with only the trial claim metadata", async () => {
    await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
      .toEqual({ ok: true });

    expect(createUser).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: valid.password,
      email_confirm: true,
      user_metadata: {
        acquisition_trial_id: valid.trialId,
        acquisition_trial_token: valid.claimToken,
      },
    });
  });

  it.each([
    [{ code: "email_exists", message: "Email exists" }],
    [{ code: "email_address_exists", message: "Email exists" }],
    [{ code: "user_already_exists", message: "User exists" }],
    [{ code: "unexpected", message: "Owner is already registered" }],
  ])("classifies an existing auth user without changing its password", async (error) => {
    createUser.mockResolvedValue({ data: { user: null }, error });

    await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
      .toEqual({ ok: false, code: "existing_account" });
    expect(createUser).toHaveBeenCalledOnce();
  });

  it.each([
    ["service-role construction", () => {
      createServiceRoleClient.mockImplementation(() => {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret");
      });
    }],
    ["admin createUser throw", () => {
      createUser.mockRejectedValue(new Error("auth backend secret"));
    }],
    ["other admin error", () => {
      createUser.mockResolvedValue({
        data: { user: null },
        error: { code: "backend_failure", message: "db.internal secret" },
      });
    }],
    ["missing auth user", () => {
      createUser.mockResolvedValue({ data: { user: null }, error: null });
    }],
  ])("returns unavailable for %s", async (_case, arrange) => {
    arrange();

    await expect(provisionTrialAccount(valid, valid.claimToken, now)).resolves
      .toEqual({ ok: false, code: "unavailable" });
  });

  it("returns the same public conflict for invalid claims and existing users", async () => {
    const invalidResponse = await POST(accountRequest(valid, "wrong-cookie"));
    const invalidBody = await invalidResponse.json();

    createUser.mockResolvedValue({
      data: { user: null },
      error: {
        code: "email_exists",
        message: "owner@example.com is already registered as auth_user_1",
      },
    });
    const existingResponse = await POST(accountRequest());
    const existingBody = await existingResponse.json();

    expect(invalidResponse.status).toBe(409);
    expect(existingResponse.status).toBe(409);
    expect(invalidBody).toEqual({
      ok: false,
      error: "This trial cannot create a new account. Sign in or restart with a different email.",
    });
    expect(existingBody).toEqual(invalidBody);
    expect(JSON.stringify(existingBody)).not.toContain("owner@example.com");
    expect(JSON.stringify(existingBody)).not.toContain("auth_user_1");
  });

  it("returns a redacted temporary-unavailable response for admin failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    createUser.mockRejectedValue(new Error(
      "SUPABASE_SERVICE_ROLE_KEY=secret auth_user_1 owner@example.com",
    ));

    const response = await POST(accountRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      error: "Account creation is temporarily unavailable. Please try again.",
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("auth_user_1");
    expect(JSON.stringify(body)).not.toContain("owner@example.com");
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns only ok for successful account creation", async () => {
    const response = await POST(accountRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects malformed JSON with the public invalid-request response", async () => {
    const response = await POST(new Request(
      "https://nudge.test/api/trials/account",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      },
    ));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid request.",
    });
    expect(acquisitionTrialFindFirst).not.toHaveBeenCalled();
  });

  it("rate limits account creation by IP before reading the request", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 37 });

    const response = await POST(accountRequest(
      valid,
      valid.claimToken,
      { "x-real-ip": "203.0.113.20" },
    ));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("37");
    expect(checkRateLimit).toHaveBeenCalledWith(
      "trial-account:203.0.113.20",
      { limit: 5, windowMs: 60_000 },
    );
    expect(acquisitionTrialFindFirst).not.toHaveBeenCalled();
  });
});
