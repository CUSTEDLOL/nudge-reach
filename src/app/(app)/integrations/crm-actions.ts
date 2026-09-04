"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { disconnect } from "@/modules/crm/connections";
import { tickCrmSync } from "@/modules/crm/sync";
import type { CrmProviderKey } from "@/modules/crm/types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function disconnectCrmAction(provider: CrmProviderKey): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    await disconnect(ctx.org.id, provider);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't disconnect." };
  }
  revalidatePath("/integrations");
  return { ok: true, message: "Disconnected. Existing CRM records are untouched." };
}

/** Run the sync tick now (all orgs' due jobs — the tick is idempotent and cheap). */
export async function syncCrmNowAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const pending = await prisma.crmSyncJob.count({ where: { orgId: ctx.org.id, status: "pending" } });
    const r = await tickCrmSync();
    revalidatePath("/integrations");
    return {
      ok: true,
      message: pending === 0 ? "Nothing waiting to sync." : `Synced ${r.done}, ${r.failed} will retry.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sync failed." };
  }
}
