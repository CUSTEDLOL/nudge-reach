"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Members update their OWN prefs — no role gate, but strictly own-row. */
export async function saveNotificationPrefsAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    const prefs = {
      newInboxMessage: formData.get("newInboxMessage") === "on",
      campaignCompleted: formData.get("campaignCompleted") === "on",
      automationFailed: formData.get("automationFailed") === "on",
      weeklyDigest: formData.get("weeklyDigest") === "on",
    };

    await prisma.membership.update({
      where: { id: ctx.membership.id },
      data: { notificationPrefs: prefs },
    });

    revalidatePath("/settings/notifications");
    return { ok: true, message: "Notification preferences saved." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save your preferences.",
    };
  }
}
