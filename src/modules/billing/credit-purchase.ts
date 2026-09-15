import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MICRO_USD_PER_CREDIT } from "@/modules/billing/credits";
import { PURCHASED_CREDIT_TTL_DAYS, creditPack, packLabel } from "@/modules/billing/credit-packs";
import type { AuditAction } from "@/modules/orgs/audit";

/**
 * Purchased credits (docs/superpowers/plans/2026-09-15-credit-ledger.md,
 * Task 6): one `purchase` grant per paid gateway payment/session, expiring
 * PURCHASED_CREDIT_TTL_DAYS out. The unique (orgId, kind, sourceKey) key lets
 * the confirm action and the webhook race safely and makes a redelivered
 * webhook a no-op. Org-scoped (invariant #5); never touches Org.plan.
 */

/** Who the audit row names: the admin who paid, or the gateway whose webhook landed first. */
export interface PurchaseActor {
  userId: string;
  name: string;
}

export const GATEWAY_ACTOR: Record<"razorpay" | "stripe", PurchaseActor> = {
  razorpay: { userId: "system", name: "gateway:razorpay" },
  stripe: { userId: "system", name: "gateway:stripe" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function grantPurchasedCredits(a: {
  orgId: string;
  packId: string;
  /** Razorpay payment id or Stripe Checkout session id — the idempotency key. */
  sourceKey: string;
  actor: PurchaseActor;
}): Promise<{ granted: boolean }> {
  const pack = creditPack(a.packId);
  if (!pack) throw new Error(`grantPurchasedCredits: unknown credit pack ${a.packId}`);
  const micro = pack.credits * MICRO_USD_PER_CREDIT;
  try {
    await prisma.creditGrant.create({
      data: {
        orgId: a.orgId,
        kind: "purchase",
        sourceKey: a.sourceKey,
        amountMicroUsd: micro,
        remainingMicroUsd: micro,
        expiresAt: new Date(Date.now() + PURCHASED_CREDIT_TTL_DAYS * DAY_MS),
        note: pack.id,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { granted: false }; // already granted for this payment
    }
    throw err;
  }
  // Fire-and-forget like recordAudit: an audit failure never fails the grant.
  const action: AuditAction = "billing.credits_purchased";
  void prisma.auditLog
    .create({
      data: {
        orgId: a.orgId,
        actorUserId: a.actor.userId,
        actorName: a.actor.name,
        action,
        target: packLabel(pack),
        detail: `${pack.id} · ${a.sourceKey}`.slice(0, 500),
      },
    })
    .catch((err) => console.error("[audit] write failed", err));
  return { granted: true };
}
