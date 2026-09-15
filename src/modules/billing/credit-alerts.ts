import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { appOrigin, sendEmail } from "@/modules/email";
import { creditSummary, formatCredits } from "@/modules/billing/credit-summary";

/**
 * The one low-balance email (plan Task 8): after a metered debit, tell the
 * OWNER once per paid period when the balance is at or under 10% of the
 * period's included credits, or at zero. Fire-and-forget from settleDebit,
 * so it never throws — a failure is logged with the [credits] tag.
 */

export const LOW_CREDIT_FRACTION = 0.1;

/** At zero, or at or under 10% of the included amount (a 0 included amount — trial — only counts at zero). */
export function isLowBalance(balanceMicroUsd: number, includedMicroUsd: number): boolean {
  if (balanceMicroUsd <= 0) return true;
  return includedMicroUsd > 0 && balanceMicroUsd <= includedMicroUsd * LOW_CREDIT_FRACTION;
}

/** Once per paid period: never told, or told before this period's included grant was issued. */
export function lowNoticeDue(notifiedAt: Date | null, includedIssuedAt: Date | null): boolean {
  if (!notifiedAt) return true;
  return includedIssuedAt !== null && notifiedAt < includedIssuedAt;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function lowCreditsEmail(a: {
  to: string;
  orgName: string;
  balanceMicroUsd: number;
  includedMicroUsd: number | null;
  estimatedReplies: number;
}) {
  const billingUrl = `${appOrigin()}/settings/billing`;
  const exhausted = a.balanceMicroUsd <= 0;
  const balance = `${formatCredits(Math.max(0, a.balanceMicroUsd))} AI credits left`;
  const included =
    a.includedMicroUsd !== null ? ` of ${formatCredits(a.includedMicroUsd)} included this period` : "";
  const estimate = `≈ ${a.estimatedReplies.toLocaleString("en-IN")} more AI replies`;
  const consequence = exhausted
    ? "AI replies, drafts, summaries and campaign copy are paused until you top up. Your inbox, campaigns and follow-ups keep working."
    : "When they run out, AI replies, drafts, summaries and campaign copy pause until you top up. Your inbox, campaigns and follow-ups keep working.";
  return {
    to: a.to,
    subject: exhausted
      ? `Your AI credits are used up — ${a.orgName}`
      : `Your AI credits are running low — ${a.orgName}`,
    text: [
      `${a.orgName} has ${balance}${included}.`,
      estimate,
      "",
      consequence,
      "",
      `Top up: ${billingUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#0b3d2e;margin:0 0 12px">${exhausted ? "Your AI credits are used up" : "Your AI credits are running low"}</h2>
        <p style="color:#374151;line-height:1.6;margin:0 0 8px">
          <strong>${escapeHtml(a.orgName)}</strong> has <strong>${escapeHtml(balance)}</strong>${escapeHtml(included)}.
          ${escapeHtml(estimate)}.
        </p>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px">${escapeHtml(consequence)}</p>
        <a href="${escapeHtml(billingUrl)}" style="display:inline-block;background:#02a258;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600">
          Top up AI credits
        </a>
      </div>`,
  };
}

const ORG_SELECT = {
  id: true,
  name: true,
  plan: true,
  featureOverrides: true,
  includedCreditsOverride: true,
  trialEndsAt: true,
  creditsLowNotifiedAt: true,
} as const;

/**
 * Send the low-balance notice if it is due. Unmetered legacy plans and
 * SEND_MODE=simulation (shadow debits, no real spend) never notify.
 * `creditsLowNotifiedAt` is stamped only after sendEmail returned — it is a
 * no-op without RESEND_API_KEY, and that still counts as "told" so a keyless
 * deployment does not retry on every reply.
 */
export async function maybeNotifyLowCredits(orgId: string, now: Date = new Date()): Promise<void> {
  try {
    if (env.SEND_MODE === "simulation") return;
    const org = await prisma.org.findUnique({ where: { id: orgId }, select: ORG_SELECT });
    if (!org) return;
    const summary = await creditSummary(org, now);
    if (summary.metering.kind !== "metered") return;
    const includedMicroUsd = summary.included?.amountMicroUsd ?? 0;
    if (!isLowBalance(summary.balanceMicroUsd, includedMicroUsd)) return;
    if (!lowNoticeDue(org.creditsLowNotifiedAt, summary.included?.issuedAt ?? null)) return;
    const owner = await prisma.membership.findFirst({
      where: { orgId, role: "OWNER" },
      select: { email: true },
    });
    if (!owner) return;
    await sendEmail(
      lowCreditsEmail({
        to: owner.email,
        orgName: org.name,
        balanceMicroUsd: summary.balanceMicroUsd,
        includedMicroUsd: summary.included ? includedMicroUsd : null,
        estimatedReplies: summary.estimatedReplies,
      })
    );
    await prisma.org.update({ where: { id: orgId }, data: { creditsLowNotifiedAt: now } });
  } catch (err) {
    console.error("[credits] low-balance notice failed", { orgId }, err);
  }
}
