import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import {
  PACK_TEMPLATES,
  PACK_LEAD_NUDGE_SPEC,
  PACK_LEAD_NUDGE_TEMPLATE_NAMES,
  normalizeTiming,
  type FollowUpFlag,
  type FollowUpTiming,
} from "@/modules/followup/pack";
import { compileFollowUp, type CompiledTemplate } from "@/modules/followup/compile";
import type { FollowUpSpec } from "@/modules/followup/spec";

/** The installed automation's name is its identity — matching on it keeps the
 *  install idempotent, so renaming it would orphan every existing install. */
export const LEAD_NUDGE_NAME = "Revenue Recovery — quiet-lead nudge";

export type FollowUpSource = "ai" | "pack" | "builder";

/** Template names are keyed on the automation so two follow-ups with the same
 *  name never share (and overwrite) a template. cuids are lowercase base36,
 *  so the tail is already Meta-safe. */
const templateKey = (automationId: string) => automationId.slice(-8);

/**
 * Create/refresh library templates by name. Test mode approves them
 * immediately (so the demo works); live keeps an unchanged row's approval and
 * sends changed copy back to Meta, recording a refusal on the row so the owner
 * can fix and resubmit.
 */
export async function ensureLibraryTemplates(
  orgId: string,
  templates: CompiledTemplate[]
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const approve = (await orgSendMode(orgId)) !== "live";
  for (const t of templates) {
    // Meta takes the components array; name/language/category travel beside it.
    const componentsJson = buildTemplatePayload(t.content, { name: t.name })
      .components as Prisma.InputJsonValue;
    const content = t.content as unknown as Prisma.InputJsonValue;
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    const unchanged =
      existing !== null && JSON.stringify(existing.content) === JSON.stringify(t.content);
    const data = {
      language: "en",
      category: t.category,
      content,
      componentsJson,
      metaStatus: approve
        ? ("APPROVED" as const)
        : unchanged
          ? existing.metaStatus
          : ("PENDING" as const),
      metaTemplateId: approve
        ? `sim-tpl-${t.name}`
        : unchanged
          ? existing.metaTemplateId
          : null,
    };
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({ data: { orgId, campaignId: null, name: t.name, ...data } });
    if (!approve && row.metaStatus !== "APPROVED") {
      await submitRowToMeta(orgId, row).catch((err: unknown) =>
        prisma.template.update({
          where: { id: row.id },
          data: {
            metaStatus: "REJECTED",
            rejectionReason: err instanceof Error ? err.message : "Couldn't submit to Meta.",
          },
        })
      );
    }
    byName.set(t.name, row.id);
  }
  return byName;
}

/** The template names a spec-backed automation already sends, in step order,
 *  so an edit re-uses (and re-approves) those rows instead of orphaning them. */
async function pinnedTemplateNames(
  steps: Array<{ kind: string; config: unknown }>
): Promise<string[]> {
  const ids = steps
    .filter((s) => s.kind === "send_template")
    .map((s) => String((s.config as { templateId?: unknown })?.templateId ?? ""))
    .filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.template.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameById = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => nameById.get(id) ?? "");
}

/**
 * Persist a spec as an automation + its templates. The automation row is
 * written first — off and step-less, which the engine ignores — so its id can
 * key the template names and a Meta failure leaves nothing half-wired. Then
 * the templates, then the steps. Creates land OFF unless `enabled` says
 * otherwise; updates keep the current switch.
 */
export async function saveFollowUpFromSpec(opts: {
  orgId: string;
  spec: FollowUpSpec;
  source: FollowUpSource;
  automationId?: string;
  name?: string;
  templateNames?: string[];
  enabled?: boolean;
}): Promise<{ id: string }> {
  const n = opts.spec.messages.length;
  const base = {
    name: opts.name ?? opts.spec.name,
    description: `${n} message${n === 1 ? "" : "s"}`,
    spec: opts.spec as unknown as Prisma.InputJsonValue,
    source: opts.source,
  };

  let id = opts.automationId;
  let pinned = opts.templateNames ?? [];
  if (id) {
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: opts.orgId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!existing) throw new Error("Follow-up not found.");
    if (!pinned.length && existing.spec !== null) pinned = await pinnedTemplateNames(existing.steps);
  } else {
    const { trigger, triggerConfig } = compileFollowUp(opts.spec);
    const created = await prisma.automation.create({
      data: {
        orgId: opts.orgId,
        enabled: opts.enabled ?? false,
        trigger,
        triggerConfig: triggerConfig as Prisma.InputJsonValue,
        ...base,
      },
      select: { id: true },
    });
    id = created.id;
  }

  const compiled = compileFollowUp(opts.spec, { templateNames: pinned, key: templateKey(id) });
  const ids = await ensureLibraryTemplates(opts.orgId, compiled.templates);
  const automationId = id;
  const steps = compiled.steps.map((s, i) => ({
    automationId,
    order: i + 1,
    kind: s.kind,
    config: (s.kind === "send_template"
      ? { templateId: ids.get(s.config.templateName) }
      : s.config) as Prisma.InputJsonValue,
  }));
  await prisma.$transaction([
    prisma.automationStep.deleteMany({ where: { automationId } }),
    prisma.automation.update({
      where: { id: automationId },
      data: { ...base, trigger: compiled.trigger, triggerConfig: compiled.triggerConfig as Prisma.InputJsonValue },
    }),
    prisma.automationStep.createMany({ data: steps }),
  ]);
  return { id: automationId };
}

/**
 * One-toggle install of the Revenue-Recovery pack for an org: the tick-driven
 * templates, the quiet-lead nudge as a spec (created once — its wording is the
 * owner's to edit from then on, so re-running never overwrites it), and an
 * enabled FollowUpConfig. Idempotent.
 */
export async function installRevenueRecoveryPack(orgId: string): Promise<void> {
  await ensureLibraryTemplates(
    orgId,
    PACK_TEMPLATES.filter((t) => !PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name))
  );
  const nudge = await prisma.automation.findFirst({
    where: { orgId, name: LEAD_NUDGE_NAME },
    select: { id: true },
  });
  if (!nudge) {
    // The one follow-up that starts ON: it is the moat the plan is sold on and
    // its copy was written and reviewed by us.
    await saveFollowUpFromSpec({
      orgId,
      spec: PACK_LEAD_NUDGE_SPEC,
      source: "pack",
      name: LEAD_NUDGE_NAME,
      templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES,
      enabled: true,
    });
  }
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true },
    update: { enabled: true },
  });
}

/** Flip the whole pack on/off (config + the lead-nudge automation together). */
export async function setFollowUpEnabled(orgId: string, enabled: boolean): Promise<void> {
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled },
    update: { enabled },
  });
  await prisma.automation.updateMany({ where: { orgId, name: LEAD_NUDGE_NAME }, data: { enabled } });
}

/** Flip ONE tick-driven follow-up on/off, leaving the rest running. */
export async function setFollowUpFlag(orgId: string, flag: FollowUpFlag, enabled: boolean): Promise<void> {
  const patch = { [flag]: enabled } as Prisma.FollowUpConfigUncheckedUpdateInput;
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true, [flag]: enabled },
    update: patch,
  });
}

/** Save when the time-absolute follow-ups fire, normalized so the tick's
 *  windows stay valid. */
export async function setFollowUpTiming(
  orgId: string,
  raw: Partial<FollowUpTiming>
): Promise<FollowUpTiming> {
  const timing = normalizeTiming(raw);
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true, ...timing },
    update: timing,
  });
  return timing;
}

export async function getFollowUpConfig(orgId: string) {
  return prisma.followUpConfig.findUnique({ where: { orgId } });
}

/** The pack's templates for this org, by template name — for the "edit the
 *  wording" links on the follow-ups page. */
export async function getPackTemplateIds(
  orgId: string
): Promise<Map<string, { id: string; metaStatus: string }>> {
  const rows = await prisma.template.findMany({
    where: {
      orgId,
      campaignId: null,
      name: { in: PACK_TEMPLATES.map((t) => t.name) },
    },
    select: { id: true, name: true, metaStatus: true },
  });
  return new Map(rows.map((r) => [r.name, { id: r.id, metaStatus: r.metaStatus }]));
}
