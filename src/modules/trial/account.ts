import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { INSTANT_TRIAL_APP_METADATA } from "./provenance";
import { hashClaimToken } from "./signup";

export const trialAccountSchema = z.object({
  trialId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  claimToken: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/),
  password: z.string().min(8).max(128),
}).strict();

export type TrialAccountResult =
  | { ok: true }
  | { ok: false; code: "invalid" | "existing_account" | "unavailable" };

function hashesMatch(candidate: string, stored: string): boolean {
  const candidateBuffer = Buffer.from(candidate, "utf8");
  const storedBuffer = Buffer.from(stored, "utf8");
  return candidateBuffer.length === storedBuffer.length
    && timingSafeEqual(candidateBuffer, storedBuffer);
}

function isExistingAccountError(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "email_exists"
    || error.code === "email_address_exists"
    || error.code === "user_already_exists"
    || Boolean(error.message?.toLowerCase().includes("already registered"))
  );
}

export async function provisionTrialAccount(
  raw: unknown,
  resumeToken: string | undefined,
  now = new Date(),
): Promise<TrialAccountResult> {
  const parsed = trialAccountSchema.safeParse(raw);
  if (!parsed.success || !resumeToken) {
    return { ok: false, code: "invalid" };
  }

  const { trialId, claimToken, password } = parsed.data;
  let trial: { emailNormalized: string; claimTokenHash: string } | null;
  try {
    trial = await prisma.acquisitionTrial.findFirst({
      where: {
        id: trialId,
        claimTokenHash: hashClaimToken(claimToken),
        claimedAt: null,
        claimExpiresAt: { gt: now },
      },
      select: {
        emailNormalized: true,
        claimTokenHash: true,
      },
    });
  } catch {
    return { ok: false, code: "unavailable" };
  }

  if (
    !trial
    || !hashesMatch(hashClaimToken(resumeToken), trial.claimTokenHash)
  ) {
    return { ok: false, code: "invalid" };
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return { ok: false, code: "unavailable" };
  }

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email: trial.emailNormalized,
      password,
      email_confirm: true,
      app_metadata: INSTANT_TRIAL_APP_METADATA,
      user_metadata: {
        acquisition_trial_id: trialId,
        acquisition_trial_token: claimToken,
      },
    });

    if (error) {
      return {
        ok: false,
        code: isExistingAccountError(error)
          ? "existing_account"
          : "unavailable",
      };
    }
    if (!data.user) return { ok: false, code: "unavailable" };
  } catch {
    return { ok: false, code: "unavailable" };
  }

  return { ok: true };
}
