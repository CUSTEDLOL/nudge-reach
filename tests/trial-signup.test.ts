import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { create, checkRateLimit } = vi.hoisted(() => ({
  create: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { acquisitionTrial: { create } } }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit,
  RATE_LIMITS: { publicForm: { limit: 5, windowMs: 60_000 } },
}));

import {
  createPendingTrial,
  trialSignupSchema,
  hashClaimToken,
} from "@/modules/trial/signup";
import { POST } from "@/app/api/trials/route";

const validSignup = {
  ownerName: "Asha",
  businessName: "Aster Clinic",
  email: "owner@aster.in",
  phone: "+919876500000",
  contactConsent: true as const,
};

describe("trial signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("requires explicit contact consent and an international phone", () => {
    expect(trialSignupSchema.safeParse({
      ownerName: "Asha",
      businessName: "Aster Clinic",
      email: "owner@aster.in",
      phone: "9876500000",
      contactConsent: false,
    }).success).toBe(false);
  });

  it("stores normalized contact data and only the token hash", async () => {
    create.mockResolvedValue({ id: "trial_1" });
    const result = await createPendingTrial({
      ownerName: " Asha ",
      businessName: " Aster Clinic ",
      email: "Owner@Aster.IN",
      phone: "+919876500000",
      contactConsent: true,
      attribution: { landingPath: "/free-trial", utmSource: "meta" },
    }, new Date("2026-09-20T00:00:00Z"));

    expect(result.claimToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      emailNormalized: "owner@aster.in",
      phoneE164: "+919876500000",
      claimTokenHash: hashClaimToken(result.claimToken),
      utmSource: "meta",
    }) });
    expect(JSON.stringify(create.mock.calls[0])).not.toContain(result.claimToken);
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      body: "{",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Invalid request.",
    });
  });

  it("rate limits repeated public signup attempts", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 31 });

    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.10" },
      body: JSON.stringify(validSignup),
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("31");
    expect(checkRateLimit).toHaveBeenCalledWith(
      "trial-signup:203.0.113.10",
      { limit: 5, windowMs: 60_000 }
    );
  });

  it("returns a duplicate-safe conflict without exposing the token hash", async () => {
    create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test" }
    ));

    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSignup),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "A trial already exists for that email or mobile. Sign in to resume it.",
    });
    expect(JSON.stringify(body)).not.toContain("claimTokenHash");
  });

  it("returns the one-time claim token without exposing its stored hash", async () => {
    create.mockResolvedValue({ id: "trial_1" });

    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSignup),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.claim.claimToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(body)).not.toContain("claimTokenHash");
  });
});
