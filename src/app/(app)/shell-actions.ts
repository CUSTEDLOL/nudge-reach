"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/modules/orgs/auth";
import { mergeUiPreferences } from "@/modules/dashboard/workspace-profile";

export async function saveSidebarCollapsedAction(
  collapsed: unknown
): Promise<{ ok: boolean }> {
  if (typeof collapsed !== "boolean") return { ok: false };

  const { membership } = await requireOrgContext();
  const uiPreferences = mergeUiPreferences(membership.uiPreferences, {
    sidebarCollapsed: collapsed,
  });
  const uiPreferencesJson: Prisma.InputJsonObject = {
    sidebarCollapsed: uiPreferences.sidebarCollapsed,
    pinnedShortcuts: uiPreferences.pinnedShortcuts,
  };

  try {
    await prisma.membership.update({
      where: { id: membership.id },
      data: { uiPreferences: uiPreferencesJson },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
