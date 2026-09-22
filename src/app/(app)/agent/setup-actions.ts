"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { parseOpeningHours } from "@/modules/calendar/hours";
import { settingsWithOpeningHours } from "@/modules/calendar/hours-store";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveAgentProfileAction(
  formData: FormData
): Promise<ActionResult> {
  // The AgentProfile controls what the AI auto-replies to customers (persona,
  // business info, on/off). It is an org-wide setting, so gate it to ADMIN+ —
  // the nav hides it from AGENTs, but the server must enforce that too (H1).
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const businessName = String(formData.get("businessName") ?? "").trim();
    const businessInfo = String(formData.get("businessInfo") ?? "").trim();
    const tone =
      String(formData.get("tone") ?? "").trim() || "Warm, friendly, and concise";
    const doNots = String(formData.get("doNots") ?? "").trim();
    const enabled = formData.get("enabled") === "on";
    const vertical = String(formData.get("vertical") ?? "restaurant");

    if (!businessName) {
      return { ok: false, message: "Please enter your business name." };
    }

    // Opening hours: "" clears them; anything else must be a valid schedule.
    const rawHours = String(formData.get("openingHours") ?? "").trim();
    let openingHours: ReturnType<typeof parseOpeningHours> = null;
    if (rawHours) {
      let json: unknown;
      try {
        json = JSON.parse(rawHours);
      } catch {
        return { ok: false, message: "Opening hours look wrong — check each day closes after it opens." };
      }
      openingHours = parseOpeningHours(json);
      if (!openingHours) {
        return { ok: false, message: "Opening hours look wrong — check each day closes after it opens." };
      }
    }

    await prisma.org.update({
      where: { id: ctx.org.id },
      data: { settings: settingsWithOpeningHours(ctx.org.settings, openingHours) },
    });

    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      create: {
        orgId: ctx.org.id,
        vertical,
        businessName,
        businessInfo,
        tone,
        doNots,
        enabled,
      },
      update: { vertical, businessName, businessInfo, tone, doNots, enabled },
    });

    revalidatePath("/agent");
    revalidatePath("/agent/setup");
    return {
      ok: true,
      message: enabled
        ? "Saved. Your WhatsApp assistant is ON and will reply to customers."
        : "Saved. Your assistant is OFF — turn it on when you're ready.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save the assistant.",
    };
  }
}

/**
 * The Training page's "Your business" section: name, what the business does,
 * and the tone — nothing else.
 *
 * Deliberately a PARTIAL write rather than a second caller of
 * `saveAgentProfileAction`. That action rebuilds the whole profile from its
 * form, so posting three fields to it would blank `businessInfo` and `doNots`
 * and switch the AI off — it would delete the very text the owner typed into
 * the Setup box. Those fields stay on /agent/setup until the migration in the
 * next change re-homes them.
 */
export async function saveBusinessBasicsAction(input: {
  businessName: string;
  vertical: string;
  tone: string;
}): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const businessName = input.businessName.trim();
    if (!businessName) {
      return { ok: false, message: "Please enter your business name." };
    }
    const tone = input.tone.trim() || "Warm, friendly, and concise";
    // Stored exactly as the picker sends it: `agentIdentity` looks the column
    // up in VERTICAL_TEMPLATES by this token, so "clinic" must stay "clinic"
    // or the beachhead loses its curated scope line for the generic one.
    const vertical = input.vertical.trim() || "other";

    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      // `enabled` is left to its default (off) on create: turning the AI on is
      // its own deliberate act, not a side effect of naming the business.
      create: { orgId: ctx.org.id, businessName, vertical, tone },
      update: { businessName, vertical, tone },
    });

    revalidatePath("/agent");
    revalidatePath("/agent/setup");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save your business.",
    };
  }
}

/** The one-click on-switch behind the "Your AI is switched off" notice. */
export async function enableAgentAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      create: {
        orgId: ctx.org.id,
        enabled: true,
        vertical: ctx.org.vertical ?? "other",
        businessName: ctx.org.name,
      },
      update: { enabled: true },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Your AI is on. Try it in chat." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't switch the AI on.",
    };
  }
}
