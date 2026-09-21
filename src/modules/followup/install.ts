import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { orgSendMode } from "@/modules/orgs/mode";
import { submitRowToMeta } from "@/modules/whatsapp/library";
import { buildTemplatePayload } from "@/modules/whatsapp/template";
import type { CampaignContent } from "@/modules/campaign/schema";
import {
  PACK_TEMPLATES,
  PACK_LEAD_NUDGE_SPEC,
  PACK_LEAD_NUDGE_TEMPLATE_NAMES,
  normalizeTiming,
  type FollowUpFlag,
  type FollowUpTiming,
} from "@/modules/followup/pack";
import { compileFollowUp, type CompiledTemplate } from "@/modules/followup/compile";
import { parseFollowUpSpec, type FollowUpSpec } from "@/modules/followup/spec";
import { draftStarterSet } from "@/modules/followup/draft";
import type { UsagePurpose } from "@/lib/model-router/usage";
import { checkAutomationLimit } from "@/modules/billing/limits";

/** The installed automation's name is its identity — matching on it keeps the
 *  install idempotent, so renaming it would orphan every existing install. */
export const LEAD_NUDGE_NAME = "Revenue Recovery — quiet-lead nudge";

export type FollowUpSource = "ai" | "pack" | "builder";

/** Template names are keyed on the automation so two follow-ups with the same
 *  name never share (and overwrite) a template. cuids are lowercase base36,
 *  so the tail is already Meta-safe. */
const templateKey = (automationId: string) => automationId.slice(-8);

/** What Meta reviews, independent of key order — jsonb reorders object keys,
 *  so a raw JSON.stringify of the stored row never equals a fresh one. */
function templateFingerprint(category: string, content: unknown): string {
  const c = (content ?? {}) as Partial<CampaignContent>;
  return JSON.stringify([
    category,
    c.header ?? "",
    c.body ?? "",
    c.footer ?? "",
    (c.buttons ?? []).map((b) => [b.type, b.text, "url" in b ? b.url : ""]),
  ]);
}

/**
 * Create/refresh library templates by name. Test mode approves them
 * immediately (so the demo works). Live: an unchanged row keeps its approval;
 * changed copy is marked PENDING and resubmitted — note submitRowToMeta
 * currently only creates, so for an existing name Meta re-syncs the OLD
 * template's status and the new copy does not reach Meta until edit-in-place
 * lands (see plan: Deferred). A refusal is recorded on the row so the owner
 * can fix and resubmit. A live workspace with no number yet submits nothing and
 * leaves the rows PENDING for prepareWorkspaceForLive to pick up.
 */
export async function ensureLibraryTemplates(
  orgId: string,
  templates: CompiledTemplate[]
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const approve = (await orgSendMode(orgId)) !== "live";
  // A live workspace with no number yet cannot reach Meta. Leave the rows
  // PENDING; prepareWorkspaceForLive submits them the moment a number connects.
  // (They used to be marked REJECTED with "Connect your WhatsApp…", and then
  // nothing ever resubmitted them.)
  const canSubmit =
    approve || (await prisma.whatsappAccount.count({ where: { orgId } })) > 0;
  for (const t of templates) {
    // Meta takes the components array; name/language/category travel beside it.
    const componentsJson = buildTemplatePayload(t.content, { name: t.name })
      .components as Prisma.InputJsonValue;
    const content = t.content as unknown as Prisma.InputJsonValue;
    const existing = await prisma.template.findFirst({
      where: { orgId, name: t.name, campaignId: null },
    });
    const unchanged =
      existing !== null &&
      templateFingerprint(existing.category, existing.content) ===
        templateFingerprint(t.category, t.content);
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
      // Kept across a copy change: Meta's edit endpoint will need it.
      metaTemplateId: approve ? `sim-tpl-${t.name}` : (existing?.metaTemplateId ?? null),
    };
    const row = existing
      ? await prisma.template.update({ where: { id: existing.id }, data })
      : await prisma.template.create({ data: { orgId, campaignId: null, name: t.name, ...data } });
    if (!approve && canSubmit && row.metaStatus !== "APPROVED") {
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
  orgId: string,
  steps: Array<{ kind: string; config: unknown }>
): Promise<string[]> {
  const ids = steps
    .filter((s) => s.kind === "send_template")
    .map((s) => String((s.config as { templateId?: unknown })?.templateId ?? ""))
    .filter(Boolean);
  if (!ids.length) return [];
  const rows = await prisma.template.findMany({
    where: { orgId, id: { in: ids } },
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
  const automationFields = {
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
    if (!pinned.length && existing.spec !== null) {
      pinned = await pinnedTemplateNames(opts.orgId, existing.steps);
    }
  } else {
    const { trigger, triggerConfig } = compileFollowUp(opts.spec);
    const created = await prisma.automation.create({
      data: {
        orgId: opts.orgId,
        enabled: opts.enabled ?? false,
        trigger,
        triggerConfig: triggerConfig as Prisma.InputJsonValue,
        ...automationFields,
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
  // A run waiting on the old steps would resume against the new list.
  const cancelWaiting = opts.automationId
    ? [
        prisma.automationRun.updateMany({
          where: { automationId, status: "WAITING" },
          data: { status: "CANCELLED", resumeAt: null },
        }),
      ]
    : [];
  await prisma.$transaction([
    ...cancelWaiting,
    prisma.automationStep.deleteMany({ where: { automationId } }),
    prisma.automation.update({
      where: { id: automationId },
      data: {
        ...automationFields,
        trigger: compiled.trigger,
        triggerConfig: compiled.triggerConfig as Prisma.InputJsonValue,
      },
    }),
    prisma.automationStep.createMany({ data: steps }),
  ]);
  return { id: automationId };
}

/**
 * One-toggle install of the Revenue-Recovery pack for an org: the tick-driven
 * templates, the quiet-lead nudge as a spec, and a FollowUpConfig.
 * The tick-driven templates are re-written from PACK_TEMPLATES on every run.
 * The nudge is created once; a legacy campaign-reply install (no spec) is
 * upgraded in place; a spec-backed one is the owner's and never overwritten.
 * Idempotent.
 *
 * A FIRST install is switched on — that is what the client is buying. A
 * re-install is not a resume: it never touches an existing config's `enabled`
 * (`update: {}`) and re-creates a missing nudge in whatever state the pack is
 * in. Only `setFollowUpEnabled(true)` — the client's own resume button —
 * un-pauses outbound, so neither the founder's "write starter set" nor a
 * re-open of /automations can start sends a client switched off.
 */
export async function installRevenueRecoveryPack(orgId: string): Promise<void> {
  await ensureLibraryTemplates(
    orgId,
    PACK_TEMPLATES.filter((t) => !PACK_LEAD_NUDGE_TEMPLATE_NAMES.includes(t.name))
  );
  const [nudge, config] = await Promise.all([
    prisma.automation.findFirst({
      where: { orgId, name: LEAD_NUDGE_NAME },
      select: { id: true, spec: true },
    }),
    getFollowUpConfig(orgId),
  ]);
  // No spec means a legacy install from before there was any UI to edit it, so
  // upgrading keeps its id and switch. A fresh one starts ON: it is the moat
  // the plan is sold on and its copy was written and reviewed by us — unless
  // this org's pack is paused, in which case it comes back paused too.
  if (!nudge || nudge.spec === null) {
    await saveFollowUpFromSpec({
      orgId,
      spec: PACK_LEAD_NUDGE_SPEC,
      source: "pack",
      name: LEAD_NUDGE_NAME,
      templateNames: PACK_LEAD_NUDGE_TEMPLATE_NAMES,
      ...(nudge ? { automationId: nudge.id } : { enabled: config ? config.enabled : true }),
    });
  }
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true },
    update: {},
  });
}

export interface StarterSetOutcome {
  created: number;
  /** Stopped early because the plan's automation limit was reached. */
  stopped: boolean;
  /** Drafting failed entirely; the ready-made pack is still installed. */
  draftFailed: boolean;
  /** A save threw after some had succeeded. */
  failed: boolean;
}

/**
 * An org's starter set: install the tick-driven pack (a first install is
 * switched on, a re-install leaves the client's switches exactly as they
 * are), then draft a tailored set on top, which lands OFF. Both the owner's
 * first open of /automations and the founder's concierge onboarding run this,
 * so a client sees exactly what we set up for them. Never throws for a partial
 * result — what was written is always reported, and the caller writes the
 * sentence.
 */
export async function writeStarterSet(
  orgId: string,
  /** Who pays for the drafting — the founder panel absorbs it (`concierge_draft`). */
  purpose?: UsagePurpose
): Promise<StarterSetOutcome> {
  await installRevenueRecoveryPack(orgId);

  // The pack is the part we promise; drafting is the bonus. Credits gone or
  // the provider down must not lose the install.
  let specs: FollowUpSpec[];
  try {
    specs = await draftStarterSet({ orgId, purpose });
  } catch (err) {
    console.warn("[followup-starter-set] drafting failed", { orgId, err });
    return { created: 0, stopped: false, draftFailed: true, failed: false };
  }

  const existing = new Set(
    (await prisma.automation.findMany({ where: { orgId }, select: { name: true } })).map((a) =>
      a.name.toLowerCase()
    )
  );
  // Checked once, after the install: the loop only ever adds automations.
  const limit = await checkAutomationLimit(orgId);
  const room = limit.limit === null ? Infinity : Math.max(0, limit.limit - limit.used);

  // A save that fails midway must not lose the ones already written: the
  // boundary is inside the loop, and what was created is always reported.
  const outcome: StarterSetOutcome = { created: 0, stopped: false, draftFailed: false, failed: false };
  for (const spec of specs) {
    if (existing.has(spec.name.toLowerCase())) continue;
    if (outcome.created >= room) {
      outcome.stopped = true;
      break;
    }
    // Defence in depth: the keyless helpers can hand back an unparsed spec.
    const parsed = parseFollowUpSpec(spec);
    if (!parsed.ok) continue;
    try {
      await saveFollowUpFromSpec({ orgId, spec: parsed.spec, source: "ai" });
      outcome.created++;
      existing.add(spec.name.toLowerCase()); // the model repeats itself
    } catch (err) {
      console.warn("[followup-starter-set] save failed", { orgId, name: spec.name, err });
      outcome.failed = true;
      break;
    }
  }
  return outcome;
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

/**
 * Flip ONE tick-driven follow-up on/off, leaving the rest running.
 * Switching any row ON also resumes the pack: `enabled: false` (a founder
 * pause) is the master switch the tick reads, and with the pause card gone
 * this is the owner's only way back — a paused org could otherwise never send
 * again. Switching a row OFF never pauses the pack.
 */
export async function setFollowUpFlag(orgId: string, flag: FollowUpFlag, enabled: boolean): Promise<void> {
  const patch = { [flag]: enabled } as Prisma.FollowUpConfigUncheckedUpdateInput;
  await prisma.followUpConfig.upsert({
    where: { orgId },
    create: { orgId, enabled: true, [flag]: enabled },
    update: { ...patch, ...(enabled ? { enabled: true } : {}) },
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
