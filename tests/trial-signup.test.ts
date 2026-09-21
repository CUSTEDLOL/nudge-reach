import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { create, findFirst, deleteMany, updateMany, checkRateLimit } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  checkRateLimit: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { acquisitionTrial: { create, findFirst, deleteMany, updateMany } },
}));
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
    findFirst.mockResolvedValue(null);
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

    expect(trialSignupSchema.safeParse({
      ...validSignup,
      phone: "9876500000",
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

  it("stores only an HTTP(S) referrer origin", async () => {
    create.mockResolvedValue({ id: "trial_1" });

    await createPendingTrial({
      ...validSignup,
      attribution: {
        landingPath: "/free-trial",
        referrer: "https://partner.example/private?email=person@example.com#secret",
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ referrer: "https://partner.example" }),
    });
    expect(trialSignupSchema.safeParse({
      ...validSignup,
      attribution: {
        landingPath: "/free-trial",
        referrer: "javascript:alert(1)",
      },
    }).success).toBe(false);
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

  it("resumes the same unclaimed trial only with its HTTP-only resume secret", async () => {
    const resumeToken = "r".repeat(43);
    findFirst.mockResolvedValue({
      id: "trial_1",
      emailNormalized: validSignup.email,
      phoneE164: validSignup.phone,
      claimTokenHash: hashClaimToken(resumeToken),
      claimExpiresAt: new Date(Date.now() + 60_000),
      claimedAt: null,
    });

    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `nudge_trial_resume=${resumeToken}`,
      },
      body: JSON.stringify(validSignup),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      claim: {
        trialId: "trial_1",
        claimToken: resumeToken,
        expiresAt: expect.any(String),
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("extends an expired unclaimed trial only for its matching resume secret", async () => {
    const resumeToken = "r".repeat(43);
    findFirst.mockResolvedValue({
      id: "trial_expired",
      emailNormalized: validSignup.email,
      phoneE164: validSignup.phone,
      claimTokenHash: hashClaimToken(resumeToken),
      claimExpiresAt: new Date("2020-01-01T00:00:00Z"),
      claimedAt: null,
    });
    updateMany.mockResolvedValue({ count: 1 });

    const result = await createPendingTrial(validSignup, new Date(), resumeToken);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "trial_expired",
        claimedAt: null,
        claimTokenHash: hashClaimToken(resumeToken),
      },
      data: { claimExpiresAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      trialId: "trial_expired",
      claimToken: resumeToken,
    });
    expect(create).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
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

  it("logs unexpected failures without exposing backend details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("postgresql://user:secret@db.internal"));

    const response = await POST(new Request("https://nudge.test/api/trials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validSignup),
    }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Couldn't start the trial." });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(log).toHaveBeenCalledWith(
      "[trial-signup] create failed",
      expect.any(Error)
    );
    log.mockRestore();
  });
});
