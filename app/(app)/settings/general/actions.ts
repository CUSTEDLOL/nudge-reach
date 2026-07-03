"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/lib/auth";
import { COUNTRY_PRESETS } from "@/lib/billing/money";

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
