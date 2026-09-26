"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { isVertical } from "@/modules/dashboard/verticals";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function saveGeneralSettingsAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const name = String(formData.get("name") ?? "").trim();
    const vertical = String(formData.get("vertical") ?? "").trim();
    const avgRaw = String(formData.get("avgOrderValueInr") ?? "").trim();

    if (!name) {
      return { ok: false, message: "Please enter a workspace name." };
    }
    // A legacy value the workspace already has may be re-saved unchanged.
    if (vertical && !isVertical(vertical) && vertical !== ctx.org.vertical) {
      return { ok: false, message: "Pick a business type from the list." };
    }
    const avgOrderValueInr = Number(avgRaw);
    if (
      !Number.isFinite(avgOrderValueInr) ||
      avgOrderValueInr <= 0 ||
      avgOrderValueInr > 10_000_000
    ) {
      return {
        ok: false,
        message: "Average order value must be a positive amount in rupees.",
      };
    }

    const current =
      typeof ctx.org.settings === "object" &&
      ctx.org.settings !== null &&
      !Array.isArray(ctx.org.settings)
        ? (ctx.org.settings as Record<string, unknown>)
        : {};

    // Optional country change (global outreach): a known preset updates the
    // dial code, billing currency and timezone together.
    const countryCode = String(formData.get("country") ?? "").trim();
    const preset = countryCode
      ? COUNTRY_PRESETS.find((p) => p.code === countryCode)
      : undefined;

    await prisma.org.update({
      where: { id: ctx.org.id },
      data: {
        name,
        vertical: vertical || null,
        ...(preset && preset.code !== "OTHER"
          ? {
              dialCode: preset.dialCode,
              currency: preset.currency,
              timezone: preset.timezone,
            }
          : {}),
        settings: {
          ...current,
          avgOrderValueInr: Math.round(avgOrderValueInr),
        } as Prisma.InputJsonValue,
      },
    });

    // The AI introduces itself from its profile's vertical, so the business
    // type chosen here has to reach it — otherwise the agent keeps talking
    // like whatever type the workspace started as.
    if (vertical) {
      await prisma.agentProfile.updateMany({
        where: { orgId: ctx.org.id },
        data: { vertical },
      });
    }

    revalidatePath("/settings/general");
    revalidatePath("/dashboard");
    return { ok: true, message: "Workspace settings saved." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save the settings.",
    };
  }
}
