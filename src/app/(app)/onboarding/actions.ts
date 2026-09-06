"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { isVertical } from "@/modules/dashboard/verticals";
import {
  deriveWorkspaceDefaults,
  mergeUiPreferences,
  mergeWorkspaceProfile,
  parseWorkspaceProfile,
  type WorkspaceProfile,
} from "@/modules/dashboard/workspace-profile";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface WorkspaceProfileActionResult extends ActionResult {
  profile?: WorkspaceProfile;
}

/** Autosave one or more validated discovery answers. Presentation defaults are
 * written for the current member only and never change their role or sends. */
export async function saveWorkspaceProfileStepAction(
  patch: unknown
): Promise<WorkspaceProfileActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Not allowed.",
    };
  }

  try {
    const settings = mergeWorkspaceProfile(ctx.org.settings, patch);
    const profile = parseWorkspaceProfile(settings);
    const defaults = deriveWorkspaceDefaults(profile);
    const uiPreferences = mergeUiPreferences(ctx.membership.uiPreferences, {
      pinnedShortcuts: defaults.shortcuts,
    });
    const uiPreferencesJson: Prisma.InputJsonObject = {
      sidebarCollapsed: uiPreferences.sidebarCollapsed,
      pinnedShortcuts: uiPreferences.pinnedShortcuts,
    };

    await prisma.$transaction([
      prisma.org.update({
        where: { id: ctx.org.id },
        data: { settings: settings as Prisma.InputJsonValue },
      }),
      prisma.membership.update({
        where: { id: ctx.membership.id },
        data: { uiPreferences: uiPreferencesJson },
      }),
    ]);

    revalidatePath("/onboarding");
    revalidatePath("/dashboard");
    return { ok: true, message: "Saved.", profile };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Couldn't save your answer — please try again.",
    };
  }
}

/** Step 1: business name + vertical → Org. Admin-gated (renames the org). */
export async function saveBusinessProfileAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Not allowed.",
    };
  }

  const name = String(formData.get("businessName") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "").trim();
  if (name.length < 2) {
    return {
      ok: false,
      message: "Tell us your business name (at least 2 characters).",
    };
  }
  if (!isVertical(vertical)) {
    return { ok: false, message: "Pick the option closest to your business." };
  }

  // Country sets phone dial code, billing currency and timezone in one step
  // (global outreach); adjustable later in Settings → General.
  const countryCode = String(formData.get("country") ?? "").trim();
  const preset = COUNTRY_PRESETS.find((p) => p.code === countryCode);
  if (!preset) {
    return { ok: false, message: "Pick your country." };
  }

  try {
    await prisma.org.update({
      where: { id: ctx.org.id },
      data: {
        name,
        vertical,
        ...(preset.code !== "OTHER"
          ? {
              dialCode: preset.dialCode,
              currency: preset.currency,
              timezone: preset.timezone,
            }
          : {}),
      },
    });
    // The AI employee introduces itself as this business from the first
    // message; the owner refines tone and facts on AI Agent → Setup.
    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      create: { orgId: ctx.org.id, enabled: true, vertical, businessName: name },
      update: { vertical, businessName: name },
    });
  } catch {
    return { ok: false, message: "Couldn't save — please try again." };
  }

  // The org name shows in the shell topbar/sidebar too.
  revalidatePath("/", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved — nice to meet you!" };
}

/**
 * Finish (or skip) the wizard — sets Org.onboardedAt so the dashboard stops
 * redirecting here. `next=contacts` lands on the import flow, anything else
 * on the dashboard. Redirects on success.
 */
export async function completeOnboardingAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const next = String(formData.get("next") ?? "dashboard");
  try {
    requireRole(ctx, "ADMIN");
    const settings = mergeWorkspaceProfile(ctx.org.settings, {
      lastCompletedStep: 8,
    });
    const profile = parseWorkspaceProfile(settings);
    const defaults = deriveWorkspaceDefaults(profile);
    const uiPreferences = mergeUiPreferences(ctx.membership.uiPreferences, {
      pinnedShortcuts: defaults.shortcuts,
    });
    const uiPreferencesJson: Prisma.InputJsonObject = {
      sidebarCollapsed: uiPreferences.sidebarCollapsed,
      pinnedShortcuts: uiPreferences.pinnedShortcuts,
    };

    await prisma.$transaction([
      prisma.org.update({
        where: { id: ctx.org.id },
        data: {
          onboardedAt: new Date(),
          settings: settings as Prisma.InputJsonValue,
        },
      }),
      prisma.membership.update({
        where: { id: ctx.membership.id },
        data: { uiPreferences: uiPreferencesJson },
      }),
    ]);
    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Couldn't finish setup — please try again.",
    };
  }
  redirect(next === "contacts" ? "/contacts" : "/dashboard");
}
