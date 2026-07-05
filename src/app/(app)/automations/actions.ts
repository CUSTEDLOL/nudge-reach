"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { checkAutomationLimit } from "@/modules/billing/limits";
import { runAutomation, type RunLogEntry } from "@/modules/automation/engine";
import { parseAutomationDraft, type AutomationDraft } from "@/modules/automation/draft";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface SaveAutomationResult extends ActionResult {
  /** Set on successful create so the builder can navigate to the editor. */
  id?: string;
}

export interface TestRunResult extends ActionResult {
  status?: string;
  log?: RunLogEntry[];
}

/** Create or update an automation from the builder payload (ADMIN+). */
export async function saveAutomation(
  formData: FormData
): Promise<SaveAutomationResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const orgId = ctx.org.id;

    let payload: unknown;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "That form payload didn't parse — try again." };
    }
    const parsed = parseAutomationDraft(payload);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const draft = parsed.draft;

    const referenceProblem = await checkStepReferences(orgId, draft);
    if (referenceProblem) return { ok: false, message: referenceProblem };

    const stepsCreate = draft.steps.map((step, index) => ({
      order: index + 1,
      kind: step.kind,
      config: step.config as Prisma.InputJsonObject,
    }));

    const id = String(formData.get("id") ?? "").trim();
    if (id) {
      const existing = await prisma.automation.findFirst({
        where: { id, orgId },
        select: { id: true, trigger: true, triggerConfig: true },
      });
      if (!existing) return { ok: false, message: "Automation not found." };

      // Keyword configs come from the builder; other triggers keep whatever
      // config they already had (e.g. a seeded tag_added scoped to one tag)
      // as long as the trigger itself didn't change.
      const triggerConfig =
        draft.trigger === "keyword"
          ? (draft.triggerConfig as Prisma.InputJsonObject)
          : existing.trigger === draft.trigger
            ? (existing.triggerConfig as Prisma.InputJsonObject)
            : {};

      await prisma.$transaction([
        prisma.automationStep.deleteMany({ where: { automationId: id } }),
        prisma.automation.update({
          where: { id },
          data: {
            name: draft.name,
            description: draft.description,
            enabled: draft.enabled,
            trigger: draft.trigger,
            triggerConfig,
            steps: { create: stepsCreate },
          },
        }),
      ]);
      revalidatePath("/automations");
      revalidatePath(`/automations/${id}`);
      return { ok: true, message: "Automation saved.", id };
    }

    // Plan limit: automations (creates only — edits are always allowed).
    const limit = await checkAutomationLimit(orgId);
    if (!limit.allowed) return { ok: false, message: limit.message };

    const created = await prisma.automation.create({
      data: {
        orgId,
        name: draft.name,
        description: draft.description,
        enabled: draft.enabled,
        trigger: draft.trigger,
        triggerConfig:
          draft.trigger === "keyword"
            ? (draft.triggerConfig as Prisma.InputJsonObject)
            : {},
        steps: { create: stepsCreate },
      },
      select: { id: true },
    });
    revalidatePath("/automations");
    return { ok: true, message: "Automation created.", id: created.id };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save the automation.",
    };
  }
}

/** Inline enable/pause from the list or builder (ADMIN+). */
export async function toggleAutomation(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");

    const id = String(formData.get("automationId") ?? "");
    const enabled = formData.get("enabled") === "true";
    const updated = await prisma.automation.updateMany({
      where: { id, orgId: ctx.org.id },
      data: { enabled },
    });
    if (updated.count === 0) return { ok: false, message: "Automation not found." };

    revalidatePath("/automations");
    revalidatePath(`/automations/${id}`);
    return {
      ok: true,
      message: enabled ? "Automation enabled." : "Automation paused.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not update the automation.",
    };
  }
}

/** Delete an automation and its runs (ADMIN+). */
export async function deleteAutomation(
  formData: FormData
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");

    const id = String(formData.get("automationId") ?? "");
    const deleted = await prisma.automation.deleteMany({
      where: { id, orgId: ctx.org.id },
    });
    if (deleted.count === 0) return { ok: false, message: "Automation not found." };

    revalidatePath("/automations");
    return { ok: true, message: "Automation deleted." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not delete the automation.",
    };
  }
}

/**
 * Test run (ADMIN+): executes the saved steps against a chosen contact right
 * now — real persistence, simulation-mode sends — and returns the step log
 * for inline display.
 */
export async function testRunAutomation(
  formData: FormData
): Promise<TestRunResult> {
  try {
    const ctx = await requireOrgContext();
    requireRole(ctx, "ADMIN");
    const orgId = ctx.org.id;

    const automationId = String(formData.get("automationId") ?? "");
    const contactId = String(formData.get("contactId") ?? "");
    if (!contactId) return { ok: false, message: "Pick a contact to test with." };

    const automation = await prisma.automation.findFirst({
      where: { id: automationId, orgId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (!automation) return { ok: false, message: "Automation not found." };
    if (automation.steps.length === 0) {
      return { ok: false, message: "Save at least one step before test-running." };
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, orgId },
      select: { id: true },
    });
    if (!contact) return { ok: false, message: "Contact not found." };

    const conversation = await prisma.conversation.findFirst({
      where: { orgId, contactId },
      select: { id: true },
    });

    const outcome = await runAutomation(automation, {
      orgId,
      contactId,
      conversationId: conversation?.id,
    });

    revalidatePath("/automations");
    revalidatePath(`/automations/${automationId}/runs`);

    const messages: Record<string, string> = {
      COMPLETED: "Test run completed — every step succeeded.",
      FAILED: "Test run failed — check the step log below.",
      WAITING: "Test run paused at a wait step; it resumes automatically.",
      RUNNING: "Test run started.",
    };
    return {
      ok: outcome.status !== "FAILED",
      message: messages[outcome.status] ?? "Test run finished.",
      status: outcome.status,
      log: outcome.log,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not run the test.",
    };
  }
}

/** Org-scoped existence checks for step references (template/tag/member). */
async function checkStepReferences(
  orgId: string,
  draft: AutomationDraft
): Promise<string | null> {
  for (let i = 0; i < draft.steps.length; i++) {
    const step = draft.steps[i];
    const n = i + 1;
    if (step.kind === "send_template") {
      const template = await prisma.template.findFirst({
        where: { id: String(step.config.templateId), orgId },
        select: { name: true, metaStatus: true },
      });
      if (!template) return `Step ${n}: that template isn't in your library.`;
      if (template.metaStatus !== "APPROVED") {
        return `Step ${n}: "${template.name}" is still ${template.metaStatus.toLowerCase()} — only approved templates can be sent.`;
      }
    }
    if (step.kind === "add_tag") {
      const tag = await prisma.tag.findFirst({
        where: { id: String(step.config.tagId), orgId },
        select: { id: true },
      });
      if (!tag) return `Step ${n}: that tag doesn't exist anymore.`;
    }
    if (step.kind === "assign_agent") {
      const member = await prisma.membership.findFirst({
        where: { orgId, userId: String(step.config.userId) },
        select: { id: true },
      });
      if (!member) return `Step ${n}: that teammate isn't in your workspace.`;
    }
  }
  return null;
}
