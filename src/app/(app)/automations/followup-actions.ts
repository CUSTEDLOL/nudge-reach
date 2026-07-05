"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import {
  getFollowUpConfig,
  installRevenueRecoveryPack,
  setFollowUpEnabled,
} from "@/modules/followup/install";

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
      await installRevenueRecoveryPack(ctx.org.id); // idempotent; enables
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
        ? "Revenue Recovery is ON — reminders, no-show rebooks and review asks now fire automatically."
        : "Revenue Recovery paused. Existing bookings keep their calendar events.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update Revenue Recovery.",
    };
  }
}
