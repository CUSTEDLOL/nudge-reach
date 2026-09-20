"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import {
  getFollowUpConfig,
  installRevenueRecoveryPack,
  setFollowUpEnabled,
  setFollowUpFlag,
  setFollowUpTiming,
} from "@/modules/followup/install";
import {
  FOLLOW_UP_FLAGS,
  FOLLOW_UP_KINDS,
  type FollowUpFlag,
  type FollowUpTiming,
} from "@/modules/followup/pack";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * One toggle for the whole Revenue-Recovery pack. Flagship-gated. Turning it on
 * installs the approved templates + composed automation (idempotent) and enables
 * the reminder tick; turning it off pauses everything.
 */
export async function toggleRevenueRecoveryAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const cfg = await getFollowUpConfig(ctx.org.id);
    const enabling = !cfg?.enabled;

    if (enabling) {
      // Installs anything missing, then resumes the nudge that pause switched off.
      await installRevenueRecoveryPack(ctx.org.id);
      await setFollowUpEnabled(ctx.org.id, true);
    } else {
      await setFollowUpEnabled(ctx.org.id, false);
    }

    recordAudit(
      ctx,
      enabling ? "followup.enabled" : "followup.disabled",
      "Revenue Recovery pack"
    );
    revalidatePath("/automations");
    return {
      ok: true,
      message: enabling
        ? "Installed. Reminders, no-show rebooks, review asks and lead nudges now run — edit any of the wording below."
        : "Paused. Your templates stay saved, and existing bookings keep their calendar events.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update Revenue Recovery.",
    };
  }
}

function isFollowUpFlag(value: string): value is FollowUpFlag {
  return (FOLLOW_UP_FLAGS as readonly string[]).includes(value);
}

export interface TimingResult extends ActionResult {
  /** What was actually stored — the form shows this back, since an out-of-range
   *  or inverted pair gets corrected rather than rejected. */
  timing?: FollowUpTiming;
}

/** Save when the time-absolute follow-ups fire. Flagship-gated. */
export async function setFollowUpTimingAction(
  raw: Partial<FollowUpTiming>
): Promise<TimingResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const timing = await setFollowUpTiming(ctx.org.id, raw);

    recordAudit(ctx, "followup.timing", `Follow-up timing updated`);
    revalidatePath("/automations");
    return { ok: true, message: "Timing saved.", timing };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save that timing.",
    };
  }
}

/** Turn a single follow-up on/off without pausing the rest. Flagship-gated. */
export async function setFollowUpFlagAction(
  flag: string,
  enabled: boolean
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    if (!isFollowUpFlag(flag)) {
      return { ok: false, message: "That isn't a follow-up we know about." };
    }

    await setFollowUpFlag(ctx.org.id, flag, enabled);
    const label =
      FOLLOW_UP_KINDS.find((k) => k.flag === flag)?.label ?? "Follow-up";

    recordAudit(ctx, enabled ? "followup.enabled" : "followup.disabled", label);
    revalidatePath("/automations");
    return {
      ok: true,
      message: enabled ? `${label} is on.` : `${label} paused.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update that follow-up.",
    };
  }
}
