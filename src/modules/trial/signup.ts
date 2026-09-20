import "server-only";
import { createHash, randomBytes } from "node:crypto";
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

export async function createPendingTrial(
  raw: z.input<typeof trialSignupSchema>,
  now = new Date()
) {
  const input = trialSignupSchema.parse(raw);
  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164 || !input.phone.startsWith("+")) {
    throw new Error("Enter the mobile number with its country code.");
  }

  const claimToken = randomBytes(32).toString("base64url");
  const row = await prisma.acquisitionTrial.create({
    data: {
      ownerName: input.ownerName,
      businessName: input.businessName,
      email: input.email,
      emailNormalized: input.email.toLowerCase(),
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
