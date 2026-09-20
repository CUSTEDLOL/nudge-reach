import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizePhoneE164 } from "@/lib/phone";

const safeOptional = z.string().trim().max(200).optional();
const safeReferrer = z.string().trim().max(200).transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "Referrer must use HTTP or HTTPS." });
      return z.NEVER;
    }
    return url.origin;
  } catch {
    ctx.addIssue({ code: "custom", message: "Referrer must be a valid URL." });
    return z.NEVER;
  }
}).optional();

export const trialSignupSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24).refine(
    (value) => value.startsWith("+") && Boolean(normalizePhoneE164(value)),
    "Enter the mobile number with its country code."
  ),
  contactConsent: z.literal(true),
  honeypot: z.string().max(0).optional(),
  attribution: z.object({
    landingPath: z.string().startsWith("/").max(200).default("/free-trial"),
    referrer: safeReferrer,
    utmSource: safeOptional,
    utmMedium: safeOptional,
    utmCampaign: safeOptional,
    gaClientId: z.string().max(64).optional(),
  }).default({ landingPath: "/free-trial" }),
});

export function hashClaimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const TRIAL_RESUME_COOKIE = "nudge_trial_resume";

export class TrialSignupConflictError extends Error {}

function tokenMatches(storedHash: string, candidate: string | undefined) {
  if (!candidate) return false;
  const candidateHash = hashClaimToken(candidate);
  if (storedHash.length !== candidateHash.length) return false;
  return timingSafeEqual(Buffer.from(storedHash), Buffer.from(candidateHash));
}

export async function createPendingTrial(
  raw: z.input<typeof trialSignupSchema>,
  now = new Date(),
  resumeToken?: string,
) {
  const input = trialSignupSchema.parse(raw);
  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164 || !input.phone.startsWith("+")) {
    throw new Error("Enter the mobile number with its country code.");
  }

  const emailNormalized = input.email.toLowerCase();
  const existing = await prisma.acquisitionTrial.findFirst({
    where: {
      OR: [{ emailNormalized }, { phoneE164 }],
    },
    select: {
      id: true,
      emailNormalized: true,
      phoneE164: true,
      claimTokenHash: true,
      claimExpiresAt: true,
      claimedAt: true,
    },
  });

  if (existing) {
    const exactIntake = existing.emailNormalized === emailNormalized
      && existing.phoneE164 === phoneE164;
    const canResume = !existing.claimedAt
      && exactIntake
      && tokenMatches(existing.claimTokenHash, resumeToken);

    if (canResume && existing.claimExpiresAt > now) {
      return { trialId: existing.id, claimToken: resumeToken! };
    }

    if (!existing.claimedAt && existing.claimExpiresAt <= now) {
      const removed = await prisma.acquisitionTrial.deleteMany({
        where: {
          id: existing.id,
          claimedAt: null,
          claimExpiresAt: { lte: now },
        },
      });
      if (removed.count !== 1) throw new TrialSignupConflictError();
    } else {
      throw new TrialSignupConflictError();
    }
  }

  const claimToken = randomBytes(32).toString("base64url");
  const row = await prisma.acquisitionTrial.create({
    data: {
      ownerName: input.ownerName,
      businessName: input.businessName,
      email: input.email,
      emailNormalized,
      phoneE164,
      contactConsentAt: now,
      claimTokenHash: hashClaimToken(claimToken),
      claimExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      landingPath: input.attribution.landingPath,
      referrer: input.attribution.referrer,
      utmSource: input.attribution.utmSource,
      utmMedium: input.attribution.utmMedium,
      utmCampaign: input.attribution.utmCampaign,
      gaClientId: input.attribution.gaClientId,
    },
  });

  return { trialId: row.id, claimToken };
}
