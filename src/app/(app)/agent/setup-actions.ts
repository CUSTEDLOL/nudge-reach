"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * The Training page's "Your business" section: name, what the business does,
 * and the tone — nothing else.
 *
 * Deliberately a PARTIAL write. The retired Setup page's action rebuilt the
 * whole profile from one form, so any caller posting a subset blanked the rest;
 * this one touches three columns and leaves `businessInfo`, `doNots` and the
 * on/off switch exactly as they were.
 */
export async function saveBusinessBasicsAction(input: {
  businessName: string;
  vertical: string;
  tone: string;
}): Promise<ActionResult> {
  // The AgentProfile decides what the AI says to customers, org-wide, so it is
  // ADMIN+ — the nav hiding it from AGENTs is not enforcement (H1).
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
    return { ok: true, message: "Saved." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save your business.",
    };
  }
}

/**
 * The AI's on/off switch, both ways.
 *
 * ON is the one-click button behind the "Your AI is switched off" notice. OFF
 * used to live only on the Setup form, and retiring that page would have left
 * an owner no way to stop the AI answering — so the switch moved to Training
 * with the rest of the AI's configuration.
 */
export async function setAutoReplyAction(
  enabled: boolean
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      create: {
        orgId: ctx.org.id,
        enabled,
        vertical: ctx.org.vertical ?? "other",
        businessName: ctx.org.name,
      },
      update: { enabled },
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: enabled
        ? "Your AI is on. Try it in chat."
        : "Your AI is off. It won't reply to anyone until you switch it back on.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't switch the AI over.",
    };
  }
}
