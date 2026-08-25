import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import { PACK_TEMPLATES, leadNudgeAutomation } from "@/modules/followup/pack";

const LEAD_NUDGE_NAME = "Revenue Recovery — quiet-lead nudge";

/** Create/refresh the pack's library templates. Test mode approves them
 *  immediately (so the demo works); live submits each to Meta for review and
 *  records a refusal on the row so the owner can fix and resubmit. */
async function ensurePackTemplates(orgId: string): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of PACK_TEMPLATES) {
    const componentsJson = buildTemplatePayload(t.content, {
      name: t.name,
    }) as Prisma.InputJsonValue;
    const data = {
      language: "en",
      category: t.category,
      content: t.content as unknown as Prisma.InputJsonValue,
      componentsJson,
      metaStatus: approve ? ("APPROVED" as const) : ("PENDING" as const),
      metaTemplateId: approve ? `sim-tpl-${t.name}` : null,
    };
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({
          data: { orgId, campaignId: null, name: t.name, ...data },
        });
    if (!approve && row.metaStatus !== "APPROVED") {
      await submitRowToMeta(orgId, row).catch((err: unknown) =>
        prisma.template.update({
          where: { id: row.id },
          data: {
            metaStatus: "REJECTED",
            rejectionReason:
              err instanceof Error ? err.message : "Couldn't submit to Meta.",
          },
        })
      );
    }
    byName.set(t.name, row.id);
  }
  return byName;
}

/**
 * One-toggle install of the Revenue-Recovery pack for an org: approved templates
 * + the composed lead-nudge automation + an enabled FollowUpConfig. Idempotent
 * (upsert by name), so re-running is safe.
 */
export async function installRevenueRecoveryPack(orgId: string): Promise<void> {
  const templates = await ensurePackTemplates(orgId);
  const recipe = leadNudgeAutomation(
    templates.get("lead_nudge_1")!,
    templates.get("lead_nudge_2")!
  );
  const stepsCreate = recipe.steps.map((s, i) => ({
    order: i + 1,
    kind: s.kind,
    config: s.config as Prisma.InputJsonValue,
  }));

  const existing = await prisma.automation.findFirst({
    where: { orgId, name: recipe.name },
  });
  if (existing) {
    await prisma.$transaction([
      prisma.automationStep.deleteMany({ where: { automationId: existing.id } }),
      prisma.automation.update({
        where: { id: existing.id },
        data: {
          description: recipe.description,
          enabled: true,
          trigger: recipe.trigger,
          triggerConfig: recipe.triggerConfig as Prisma.InputJsonValue,
          steps: { create: stepsCreate },
        },
      }),
    ]);
  } else {
    await prisma.automation.create({
      data: {
        orgId,
        name: recipe.name,
        description: recipe.description,
        enabled: true,
        trigger: recipe.trigger,
        triggerConfig: recipe.triggerConfig as Prisma.InputJsonValue,
        steps: { create: stepsCreate },
      },
    });
  }

  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true },
    update: { enabled: true },
  });
}

/** Flip the whole pack on/off (config + the lead-nudge automation together). */
export async function setFollowUpEnabled(
  orgId: string,
  enabled: boolean
): Promise<void> {
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled },
    update: { enabled },
  });
  const auto = await prisma.automation.findFirst({
    where: { orgId, name: LEAD_NUDGE_NAME },
  });
  if (auto) {
    await prisma.automation.update({ where: { id: auto.id }, data: { enabled } });
  }
}

export async function getFollowUpConfig(orgId: string) {
  return prisma.followUpConfig.findUnique({ where: { orgId } });
}
