"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import { resetDemoWorkspace } from "@/modules/demo/reset";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Reset demo data: wipe this workspace's CRM data and re-seed the demo
 * workspace. Guard-railed twice — simulation mode only (never near real
 * customer data) and OWNER only.
 */
export async function resetDemoDataAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "OWNER");
    if (env.SEND_MODE !== "simulation") {
      return {
        ok: false,
        message:
          "Demo reset is only available in simulation mode — it would wipe real customer data in live mode.",
      };
    }

    const counts = await resetDemoWorkspace(prisma, ctx.org.id);
    recordAudit(
      ctx,
      "demo.reset",
      undefined,
      `${counts.contacts} contacts, ${counts.conversations} conversations re-seeded`
    );

    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Demo workspace reset — ${counts.contacts} contacts, ${counts.conversations} conversations, ${counts.campaigns} campaigns re-seeded.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't reset the demo data.",
    };
  }
}
