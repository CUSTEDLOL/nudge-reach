import { prisma } from "@/lib/db";
import { sanitizeFeatureOverrides, type FeatureOverrides } from "@/modules/billing/limits";
import { trialEndDate } from "@/modules/billing/trial";
import { founderAudit, withReason, type FounderResult } from "@/modules/admin/audit";
import { confirmationMatches, requireReason } from "@/modules/admin/confirmation";

/**
 * Founder controls over ONE organisation's lifecycle. Every function:
 *   - validates input in plain code (no UI trust),
 *   - returns { ok, message | error } for the action to surface,
 *   - awaits an admin.* audit row in the org's own log.
 * Plan changes stay in set-plan.ts (shared with the CLI).
 */

export const SUBSCRIPTION_STATUSES = ["inactive", "active", "past_due", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export function isSubscriptionStatus(s: string): s is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(s);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TRIAL_DAYS = 180;

async function loadOrg(orgId: string) {
  return prisma.org.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      simulated: true,
      suspendedAt: true,
      trialEndsAt: true,
      subscriptionStatus: true,
      voiceMinutesOverride: true,
      featureOverrides: true,
      whatsappAccounts: { select: { id: true }, take: 1 },
    },
  });
}

function fmt(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "none";
}

/**
 * Set the trial to end N days from now (1–180), or clear it (days = 0 ⇒ no
 * trial; the plan is left as-is — change it separately if needed).
 */
export async function setTrial(
  orgId: string,
  days: number,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  if (!Number.isInteger(days) || days < 0 || days > MAX_TRIAL_DAYS) {
    return { ok: false, error: `Trial length must be a whole number of days, 0–${MAX_TRIAL_DAYS}.` };
  }
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  const trialEndsAt = days === 0 ? null : new Date(Date.now() + days * DAY_MS);
  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { trialEndsAt } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.trial_changed",
      org.name,
      withReason(`${fmt(org.trialEndsAt)} → ${fmt(trialEndsAt)}`, reason),
      tx
    );
  });
  return {
    ok: true,
    message: trialEndsAt ? `Trial now ends ${fmt(trialEndsAt)}.` : "Trial cleared.",
  };
}

/** Restart a standard trial from today (same length as a fresh signup). */
export function standardTrialEnd(now = new Date()): Date {
  return trialEndDate(now);
}

export async function setSubscriptionStatus(
  orgId: string,
  status: string,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  if (!isSubscriptionStatus(status)) return { ok: false, error: `Unknown status "${status}".` };
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  if (org.subscriptionStatus === status) return { ok: false, error: `Already ${status}.` };
  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { subscriptionStatus: status } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.subscription_changed",
      org.name,
      withReason(`${org.subscriptionStatus} → ${status}`, reason),
      tx
    );
  });
  return { ok: true, message: `Subscription marked ${status.replace("_", " ")}.` };
}

/**
 * Flip test ⇄ live. Going live requires a connected WhatsApp number — the
 * same rule the org's own go-live checklist enforces — so a founder can't
 * accidentally point real sends at a workspace with no credentials.
 */
export async function setLiveMode(
  orgId: string,
  live: boolean,
  founderEmail: string,
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  if (org.simulated === !live) return { ok: false, error: `Already ${live ? "live" : "in test mode"}.` };
  if (live && org.whatsappAccounts.length === 0) {
    return { ok: false, error: "Connect a WhatsApp number first — a live workspace needs credentials to send." };
  }
  if (!confirmationMatches(org.name, confirmation ?? "")) {
    return { ok: false, error: `Type "${org.name}" exactly to confirm.` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { simulated: !live } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.mode_changed",
      org.name,
      withReason(live ? "test → live" : "live → test", requiredReason.value),
      tx
    );
  });
  return { ok: true, message: live ? "Workspace is live." : "Workspace back in test mode." };
}

/** Bespoke monthly call minutes; null clears the override (plan applies). */
export async function setVoiceMinutes(
  orgId: string,
  minutes: number | null,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 100_000)) {
    return { ok: false, error: "Minutes must be a whole number from 0 to 100,000, or blank for the plan default." };
  }
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  if (org.voiceMinutesOverride === minutes) return { ok: false, error: "No change." };
  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { voiceMinutesOverride: minutes } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.voice_minutes_changed",
      org.name,
      withReason(`${org.voiceMinutesOverride ?? "plan"} → ${minutes ?? "plan"}`, reason),
      tx
    );
  });
  return { ok: true, message: minutes === null ? "Back on the plan's minutes." : `${minutes} minutes/month.` };
}

/** Suspend: app locked + every outbound send refused (enforced in core). */
export async function setSuspended(
  orgId: string,
  suspended: boolean,
  founderEmail: string,
  reason?: string,
  confirmation?: string
): Promise<FounderResult> {
  const requiredReason = requireReason(reason);
  if (!requiredReason.ok) return requiredReason;
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  if (Boolean(org.suspendedAt) === suspended) {
    return { ok: false, error: suspended ? "Already suspended." : "Not suspended." };
  }
  if (!confirmationMatches(org.name, confirmation ?? "")) {
    return { ok: false, error: `Type "${org.name}" exactly to confirm.` };
  }
  await prisma.$transaction(async (tx) => {
    await tx.org.update({
      where: { id: org.id },
      data: { suspendedAt: suspended ? new Date() : null },
    });
    await founderAudit(
      org.id,
      founderEmail,
      suspended ? "admin.suspended" : "admin.unsuspended",
      org.name,
      withReason(
        suspended ? "workspace locked, sends refused" : "workspace unlocked",
        requiredReason.value
      ),
      tx
    );
  });
  return { ok: true, message: suspended ? "Workspace suspended." : "Suspension lifted." };
}

/** Replace the org's feature overrides (sanitized; unknown keys dropped). */
export async function setFeatureOverrides(
  orgId: string,
  raw: unknown,
  founderEmail: string,
  reason?: string
): Promise<FounderResult> {
  const next: FeatureOverrides = sanitizeFeatureOverrides(raw);
  const org = await loadOrg(orgId);
  if (!org) return { ok: false, error: "Org not found." };
  const before = JSON.stringify(sanitizeFeatureOverrides(org.featureOverrides));
  const after = JSON.stringify(next);
  if (before === after) return { ok: false, error: "No change." };
  await prisma.$transaction(async (tx) => {
    await tx.org.update({ where: { id: org.id }, data: { featureOverrides: next } });
    await founderAudit(
      org.id,
      founderEmail,
      "admin.overrides_changed",
      org.name,
      withReason(`${before} → ${after}`, reason),
      tx
    );
  });
  return {
    ok: true,
    message: Object.keys(next).length ? "Overrides saved." : "Overrides cleared — plan limits apply.",
  };
}

/** Internal notes — founder-only, never shown to the client, not audited. */
export async function setFounderNotes(orgId: string, notes: string): Promise<FounderResult> {
  const trimmed = notes.trim().slice(0, 4000);
  try {
    await prisma.org.update({ where: { id: orgId }, data: { founderNotes: trimmed || null } });
    return { ok: true, message: "Notes saved." };
  } catch {
    return { ok: false, error: "Org not found." };
  }
}

/** Parse the overrides form: "" ⇒ inherit, "on"/"off" for flags, numbers or "unlimited" for counts. */
export function parseOverridesForm(form: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(form)) {
    const v = raw.trim().toLowerCase();
    if (v === "" || v === "inherit") continue;
    if (v === "on" || v === "true") out[key] = true;
    else if (v === "off" || v === "false") out[key] = false;
    else if (v === "unlimited" || v === "null") out[key] = null;
    else if (/^\d+$/.test(v)) out[key] = Number(v);
  }
  return out;
}
