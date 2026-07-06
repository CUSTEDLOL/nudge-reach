"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { COUNTRY_PRESETS } from "@/modules/billing/money";
import { isVertical } from "@/modules/dashboard/verticals";

export interface ActionResult {
  ok: boolean;
  message: string;
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
  } catch {
    return { ok: false, message: "Couldn't save — please try again." };
  }

  // The org name shows in the shell topbar/sidebar too.
  revalidatePath("/", "layout");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true, message: "Saved — nice to meet you!" };
}

async function markOnboarded(orgId: string): Promise<void> {
  await prisma.org.update({
    where: { id: orgId },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
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
    await markOnboarded(ctx.org.id);
  } catch {
    return { ok: false, message: "Couldn't finish setup — please try again." };
  }
  redirect(next === "contacts" ? "/contacts" : "/dashboard");
}
