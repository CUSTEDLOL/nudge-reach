"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { prisma } from "@/lib/db";
import {
  buildBusinessInfo,
  installClientGrounding,
  installVerticalPack,
  type KnowledgeBaseInput,
} from "@/modules/concierge";
import { installRevenueRecoveryPack } from "@/modules/followup/install";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

/**
 * One-pass concierge client setup (flagship-gated): knowledge base → agent
 * persona (enabled) + a per-vertical template pack + the Revenue-Recovery
 * follow-up pack. The operator connects the calendar separately; the go-live
 * gate on the page then reads green.
 *
 * The knowledge base is written TWICE on purpose. `installClientGrounding`
 * writes the rows the agent reads (active `KnowledgeEntry` facts, active
 * `never` `AgentRule` rows); `businessInfo`/`doNots` keep the operator's own
 * text, because the form reads `doNots` back to populate itself and the blob is
 * the untouched original a mis-split line can be redone from. Only the first of
 * those two reaches a prompt — see `buildBusinessInfo`.
 */
export async function saveConciergeSetupAction(
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const businessName = String(formData.get("businessName") ?? "").trim();
    const vertical = String(formData.get("vertical") ?? "clinic");
    const tone =
      String(formData.get("tone") ?? "").trim() || "Warm, friendly, and concise";
    const doNots = String(formData.get("doNots") ?? "").trim();
    if (!businessName) {
      return { ok: false, message: "Enter the client's business name." };
    }

    const knowledge: KnowledgeBaseInput = {
      hours: str(formData, "hours"),
      location: str(formData, "location"),
      services: str(formData, "services"),
      prices: str(formData, "prices"),
      policies: str(formData, "policies"),
      faqs: str(formData, "faqs"),
    };
    const businessInfo = buildBusinessInfo(knowledge);
    if (!businessInfo) {
      return {
        ok: false,
        message:
          "Add at least the hours and services so the agent has something real to say.",
      };
    }

    await prisma.agentProfile.upsert({
      where: { orgId: ctx.org.id },
      create: {
        orgId: ctx.org.id,
        vertical,
        businessName,
        businessInfo,
        tone,
        doNots,
        enabled: true,
      },
      update: { vertical, businessName, businessInfo, tone, doNots, enabled: true },
    });
    await prisma.org.update({ where: { id: ctx.org.id }, data: { vertical } });

    const grounding = await installClientGrounding(ctx.org.id, knowledge, doNots);
    const packCount = await installVerticalPack(ctx.org.id, vertical);
    await installRevenueRecoveryPack(ctx.org.id);

    recordAudit(
      ctx,
      "concierge.client_setup",
      businessName,
      `${vertical} · ${packCount} templates · ${grounding.facts} facts · ${grounding.rules} rules`
    );
    revalidatePath("/settings/concierge");
    revalidatePath("/agent");
    // The counts are what this run CREATED: a re-run that changed nothing says
    // "+0 facts", which is the truth an operator needs to see.
    const turnedBack = grounding.rulesRejected
      ? ` ${grounding.rulesRejected} do-not line${grounding.rulesRejected === 1 ? "" : "s"} could not become a rule — reword ${grounding.rulesRejected === 1 ? "it" : "them"} on the Training page.`
      : "";
    return {
      ok: true,
      message: `${businessName} is set up — agent trained (+${grounding.facts} facts, +${grounding.rules} house rules), ${packCount} vertical templates ready, follow-ups on.${turnedBack} Connect the calendar to finish going live.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Couldn't complete setup.",
    };
  }
}
