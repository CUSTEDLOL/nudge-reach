"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAiFrontDesk, checkAutomationLimit } from "@/modules/billing/limits";
import { recordAudit } from "@/modules/orgs/audit";
import { draftFollowUp, draftStarterSet } from "@/modules/followup/draft";
import {
  getFollowUpConfig,
  installRevenueRecoveryPack,
  saveFollowUpFromSpec,
  setFollowUpEnabled,
  setFollowUpFlag,
  setFollowUpTiming,
} from "@/modules/followup/install";
import {
  parseFollowUpSpec,
  specErrorMessage,
  type FollowUpSpec,
} from "@/modules/followup/spec";
import {
  FOLLOW_UP_FLAGS,
  FOLLOW_UP_KINDS,
  type FollowUpFlag,
  type FollowUpTiming,
} from "@/modules/followup/pack";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * One toggle for the whole Revenue-Recovery pack. Flagship-gated. Turning it on
 * installs the approved templates + composed automation (idempotent) and enables
 * the reminder tick; turning it off pauses everything.
 */
export async function toggleRevenueRecoveryAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const cfg = await getFollowUpConfig(ctx.org.id);
    const enabling = !cfg?.enabled;

    if (enabling) {
      // Installs anything missing, then resumes the nudge that pause switched off.
      await installRevenueRecoveryPack(ctx.org.id);
      await setFollowUpEnabled(ctx.org.id, true);
    } else {
      await setFollowUpEnabled(ctx.org.id, false);
    }

    recordAudit(
      ctx,
      enabling ? "followup.enabled" : "followup.disabled",
      "Revenue Recovery pack"
    );
    revalidatePath("/automations");
    return {
      ok: true,
      message: enabling
        ? "Installed. Reminders, no-show rebooks, review asks and lead nudges now run — edit any of the wording below."
        : "Paused. Your templates stay saved, and existing bookings keep their calendar events.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update Revenue Recovery.",
    };
  }
}

function isFollowUpFlag(value: string): value is FollowUpFlag {
  return (FOLLOW_UP_FLAGS as readonly string[]).includes(value);
}

export interface TimingResult extends ActionResult {
  /** What was actually stored — the form shows this back, since an out-of-range
   *  or inverted pair gets corrected rather than rejected. */
  timing?: FollowUpTiming;
}

/** Save when the time-absolute follow-ups fire. Flagship-gated. */
export async function setFollowUpTimingAction(
  raw: Partial<FollowUpTiming>
): Promise<TimingResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const timing = await setFollowUpTiming(ctx.org.id, raw);

    recordAudit(ctx, "followup.timing", `Follow-up timing updated`);
    revalidatePath("/automations");
    return { ok: true, message: "Timing saved.", timing };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save that timing.",
    };
  }
}

/** Turn a single follow-up on/off without pausing the rest. Flagship-gated. */
export async function setFollowUpFlagAction(
  flag: string,
  enabled: boolean
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    if (!isFollowUpFlag(flag)) {
      return { ok: false, message: "That isn't a follow-up we know about." };
    }

    await setFollowUpFlag(ctx.org.id, flag, enabled);
    const label =
      FOLLOW_UP_KINDS.find((k) => k.flag === flag)?.label ?? "Follow-up";

    recordAudit(ctx, enabled ? "followup.enabled" : "followup.disabled", label);
    revalidatePath("/automations");
    return {
      ok: true,
      message: enabled ? `${label} is on.` : `${label} paused.`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't update that follow-up.",
    };
  }
}

export interface DraftResult extends ActionResult {
  /** The unsaved draft the owner reviews before it is created. */
  spec?: FollowUpSpec;
}

/** Sentence → reviewable spec. Nothing is saved. ADMIN + AI Front Desk. */
export async function draftFollowUpAction(request: string): Promise<DraftResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    const spec = await draftFollowUp({
      orgId: ctx.org.id,
      request: String(request ?? "").slice(0, 500),
    });
    return { ok: true, message: "Here's a draft — edit anything, then create it.", spec };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't draft that follow-up.",
    };
  }
}

export interface CreateResult extends ActionResult {
  id?: string;
  /** What was actually stored — parse repairs the draft ({{1}}, the STOP
   *  footer, a quiet chase's first message), so the card renders this, not
   *  the version the owner submitted. */
  spec?: FollowUpSpec;
}

/** Save a reviewed spec as a new follow-up. Lands OFF. */
export async function createFollowUpAction(raw: unknown): Promise<CreateResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };
    // Plan limit: automations (creates only, exactly like the builder's save).
    const limit = await checkAutomationLimit(ctx.org.id);
    if (!limit.allowed) return { ok: false, message: limit.message };

    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: specErrorMessage(parsed.error) };

    const { id } = await saveFollowUpFromSpec({
      orgId: ctx.org.id,
      spec: parsed.spec,
      source: "ai",
    });
    recordAudit(ctx, "followup.created", parsed.spec.name);
    revalidatePath("/automations");
    return {
      ok: true,
      message: "Created — it's off until you switch it on.",
      id,
      spec: parsed.spec,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't create that follow-up.",
    };
  }
}

export interface UpdateResult extends ActionResult {
  /** The stored spec after parse's repairs — the card re-renders from this. */
  spec?: FollowUpSpec;
}

/** Re-save an edited spec over an existing follow-up (org-scoped). */
export async function updateFollowUpAction(
  id: string,
  raw: unknown
): Promise<UpdateResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { id: true, source: true },
    });
    if (!existing) return { ok: false, message: "Follow-up not found." };

    const parsed = parseFollowUpSpec(raw);
    if (!parsed.ok) return { ok: false, message: specErrorMessage(parsed.error) };

    await saveFollowUpFromSpec({
      orgId: ctx.org.id,
      spec: parsed.spec,
      // A pack follow-up stays the pack's (its templates are pinned by name);
      // anything else edited here is now spec-backed.
      source: existing.source === "pack" ? "pack" : "ai",
      automationId: id,
    });
    recordAudit(ctx, "followup.updated", parsed.spec.name);
    revalidatePath("/automations");
    revalidatePath(`/automations/${id}`);
    return {
      ok: true,
      message: "Saved. Changed wording goes back to Meta for approval.",
      spec: parsed.spec,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't save that follow-up.",
    };
  }
}

export async function deleteFollowUpAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const existing = await prisma.automation.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { name: true },
    });
    if (!existing) return { ok: false, message: "Follow-up not found." };

    // deleteMany keeps the org scope on the write, and a row that vanished
    // between the read and the write is a message, not a raw Prisma P2025.
    const { count } = await prisma.automation.deleteMany({
      where: { id, orgId: ctx.org.id },
    });
    if (!count) return { ok: false, message: "Follow-up not found." };

    recordAudit(ctx, "followup.deleted", existing.name);
    revalidatePath("/automations");
    return { ok: true, message: "Deleted. Its templates stay in your library." };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't delete that follow-up.",
    };
  }
}

export interface StarterSetResult extends ActionResult {
  /** How many drafted follow-ups were actually saved. */
  created?: number;
}

/** First-open: install the tick-driven pack (its quiet-lead nudge starts ON,
 *  as the installer has always done) AND draft a tailored set, which lands OFF. */
export async function writeStarterSetAction(): Promise<StarterSetResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const gate = await checkAiFrontDesk(ctx.org.id);
    if (!gate.allowed) return { ok: false, message: gate.message };

    await installRevenueRecoveryPack(ctx.org.id);

    // The pack is the part we promise; drafting is the bonus. Credits gone or
    // the provider down must not lose the install.
    let specs: FollowUpSpec[];
    try {
      specs = await draftStarterSet({ orgId: ctx.org.id });
    } catch (err) {
      console.warn("[followup-starter-set] drafting failed", { orgId: ctx.org.id, err });
      revalidatePath("/automations");
      return {
        ok: true,
        created: 0,
        message:
          "Installed the ready-made follow-ups, but couldn't draft the extra ones just now — try the bar above.",
      };
    }

    const existing = new Set(
      (
        await prisma.automation.findMany({
          where: { orgId: ctx.org.id },
          select: { name: true },
        })
      ).map((a) => a.name.toLowerCase())
    );
    // Checked once, after the install: the loop only ever adds automations.
    const limit = await checkAutomationLimit(ctx.org.id);
    const room = limit.limit === null ? Infinity : Math.max(0, limit.limit - limit.used);

    // A save that fails midway must not lose the ones already written: the
    // boundary is inside the loop, and what was created is always reported.
    let created = 0;
    let stopped = false;
    let failed = false;
    for (const spec of specs) {
      if (existing.has(spec.name.toLowerCase())) continue;
      if (created >= room) {
        stopped = true;
        break;
      }
      // Defence in depth: the keyless helpers can hand back an unparsed spec.
      const parsed = parseFollowUpSpec(spec);
      if (!parsed.ok) continue;
      try {
        await saveFollowUpFromSpec({ orgId: ctx.org.id, spec: parsed.spec, source: "ai" });
        created++;
        existing.add(spec.name.toLowerCase()); // the model repeats itself
      } catch (err) {
        console.warn("[followup-starter-set] save failed", {
          orgId: ctx.org.id,
          name: spec.name,
          err,
        });
        failed = true;
        break;
      }
    }

    recordAudit(ctx, "followup.drafted", `${created} drafted`);
    revalidatePath("/automations");
    const message = created
      ? `Drafted ${created} follow-up${created === 1 ? "" : "s"} for you — read them, then switch on the ones you want.`
      : stopped || failed
        ? "Installed the ready-made follow-ups."
        : "Your starter set is already here.";
    return {
      ok: true,
      created,
      message: stopped
        ? `${message} We stopped there — that's as many automations as your plan allows.`
        : failed
          ? `${message} Something went wrong after that, so we couldn't finish the rest.`
          : message,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Couldn't write your starter set.",
    };
  }
}
