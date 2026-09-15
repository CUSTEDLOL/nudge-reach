import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MICRO_USD_PER_CREDIT, creditBalance } from "@/modules/billing/credits";

/**
 * Founder-issued credits (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 7). A `founder` grant is keyed on the admin.credits_granted audit row
 * that records it, so the two are written in one transaction by
 * modules/admin/org-controls.ts and a retry can never grant twice.
 * Org-scoped (invariant #5).
 */

/** Row amounts are Int micro-USD; 400,000 credits keeps every grant inside it. */
export const MAX_FOUNDER_CREDITS = 400_000;
export const MAX_FOUNDER_GRANT_DAYS = 730;
export const DEFAULT_FOUNDER_GRANT_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure validation shared by the module and its action; null when valid. */
export function founderGrantError(credits: number, expiresInDays: number | null): string | null {
  if (!Number.isInteger(credits) || credits < 1 || credits > MAX_FOUNDER_CREDITS) {
    return `Credits must be a whole number from 1 to ${MAX_FOUNDER_CREDITS.toLocaleString("en-US")}.`;
  }
  if (
    expiresInDays !== null &&
    (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > MAX_FOUNDER_GRANT_DAYS)
  ) {
    return `Expiry must be a whole number of days from 1 to ${MAX_FOUNDER_GRANT_DAYS}, or blank for ${DEFAULT_FOUNDER_GRANT_DAYS}.`;
  }
  return null;
}

export async function grantFounderCredits(
  tx: Pick<Prisma.TransactionClient, "creditGrant">,
  a: {
    orgId: string;
    credits: number;
    expiresInDays: number | null;
    /** Id of the admin.credits_granted audit row — the grant's idempotency key. */
    auditId: string;
    note?: string | null;
  },
  now: Date = new Date()
): Promise<{ expiresAt: Date }> {
  const invalid = founderGrantError(a.credits, a.expiresInDays);
  if (invalid) throw new Error(`grantFounderCredits: ${invalid}`);
  const micro = a.credits * MICRO_USD_PER_CREDIT;
  const expiresAt = new Date(now.getTime() + (a.expiresInDays ?? DEFAULT_FOUNDER_GRANT_DAYS) * DAY_MS);
  await tx.creditGrant.create({
    data: {
      orgId: a.orgId,
      kind: "founder",
      sourceKey: a.auditId,
      amountMicroUsd: micro,
      remainingMicroUsd: micro,
      expiresAt,
      note: a.note?.trim() || null,
    },
  });
  return { expiresAt };
}

export interface CreditGrantRow {
  id: string;
  kind: string;
  amountMicroUsd: number;
  remainingMicroUsd: number;
  expiresAt: Date;
  issuedAt: Date;
  note: string | null;
}

/** What the admin card renders: the balance and every unexpired grant, newest first. */
export async function orgCreditSummary(
  orgId: string,
  now: Date = new Date()
): Promise<{ balanceMicroUsd: number; grants: CreditGrantRow[] }> {
  const [balanceMicroUsd, grants] = await Promise.all([
    creditBalance(orgId, now),
    prisma.creditGrant.findMany({
      where: { orgId, expiresAt: { gt: now } },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        kind: true,
        amountMicroUsd: true,
        remainingMicroUsd: true,
        expiresAt: true,
        issuedAt: true,
        note: true,
      },
    }),
  ]);
  return { balanceMicroUsd, grants };
}
