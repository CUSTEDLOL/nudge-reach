"use server";

import type { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgContext, requireRole } from "@/modules/orgs/auth";
import { recordAudit } from "@/modules/orgs/audit";
import { distillRule } from "@/modules/agent/distill-rule";
import { ruleLimitFor } from "@/modules/agent/rules-store";
import {
  MAX_ACTIVE_RULES,
  MAX_INSTRUCTION_LENGTH,
  MAX_RULE_TEXT_LENGTH,
  ruleSchema,
  widensScope,
  type RuleScope,
} from "@/modules/agent/rules";

/**
 * Writing house rules — how the AI should BEHAVE. Rules sit ABOVE the business
 * knowledge in the system prompt, so this is the most powerful thing an owner
 * can type: it is gated to ADMIN+ on the server (invariant #5), refuses any
 * rule that would widen the agent past this one business (invariant #7), and
 * archives rather than deletes (nothing an owner wrote is ever destroyed).
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Long enough for a realistic burst on one org to clear the advisory lock —
 * the queue is three fast statements per waiter — and short enough to answer
 * inside a serverless function's own budget. The same pair
 * `migrateProfileToRules` uses; it queues on the same key.
 */
const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 10_000 } as const;

/** Invariant #7, in owner-facing words. */
const SCOPE_WIDENING_MESSAGE =
  "Your AI only answers for your business, so it can't take a rule that opens it up to anything else. Try narrowing the rule to what you offer.";

/**
 * A transaction that ran out of time, almost always because it spent its budget
 * queued for the per-org advisory lock below. Prisma raises `P2028` for it, and
 * the raw message — "Transaction API error: Transaction already closed…" —
 * would otherwise reach the owner through `fail`.
 *
 * Matched on the code alone, by shape rather than by importing Prisma's error
 * class, so a mocked client can reproduce it. Nothing else is swallowed: a
 * genuine failure keeps its own message, and a timeout deliberately does NOT
 * say "at cap", because it is not — telling an owner their list is full when
 * it is not is worse than telling them nothing.
 */
const BUSY_MESSAGE =
  "Your rules were being saved by someone else just then, so this one didn't go through. Try again in a moment.";

function isTransactionTimeout(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2028"
  );
}

function fail(err: unknown): ActionResult {
  if (isTransactionTimeout(err)) return { ok: false, message: BUSY_MESSAGE };
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Something went wrong.",
  };
}

export async function createRuleAction(
  text: string,
  scope: string,
  condition?: string
): Promise<ActionResult> {
  // Outside the try: `requireOrgContext` redirects by throwing, and a redirect
  // swallowed into a business-error message would strand a logged-out owner.
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const parsed = parseDraft({ text, scope, condition });
    if (!parsed.ok) return { ok: false, message: parsed.message };
    const draft = parsed.draft;

    if (widensRule(draft)) {
      return { ok: false, message: SCOPE_WIDENING_MESSAGE };
    }

    // Trial workspaces carry a shorter list. Derived in `rules-store` so the
    // authoring cap, the reply path and the voice path cannot disagree.
    const limit = await ruleLimitFor(ctx.org.id);
    // Cheap early exit so an owner who is already full does not pay for a
    // distiller call. It is NOT the guard — that lives in the write below.
    const active = await prisma.agentRule.count({
      where: { orgId: ctx.org.id, status: "active" },
    });
    if (active >= limit) return { ok: false, message: atCapMessage(limit) };

    const { instruction } = await distillRule({
      orgId: ctx.org.id,
      text: draft.text,
      scope: draft.scope,
      condition: draft.condition,
    });

    // The cap is re-counted inside the write, under a per-org advisory lock —
    // the same shape `storeKnowledgeFacts` uses for the knowledge cap. Counting
    // outside the write is check-then-act: two requests (one double-clicked
    // button is enough) both read `active < limit` and both insert, and the org
    // ends up over the cap. The lock serialises rule creation per org, so the
    // count a transaction reads cannot go stale before its insert commits.
    //
    // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns void and
    // Prisma cannot deserialize a void column. The lock key is a bound
    // parameter — never interpolate owner text into SQL.
    //
    // Cost: concurrent creates for ONE org queue behind each other for the
    // three fast statements below (no model call is inside — `distillRule` ran
    // above). Different orgs take different keys and never wait. The
    // alternative, a conditional `INSERT … SELECT … WHERE (count) < n`, would
    // have to hand-write every column and generate the `@default(cuid())` id
    // itself, and would silently skip any column added to the model later.
    //
    // The wait for that lock is spent INSIDE the transaction, so it counts
    // against the transaction's own budget. Prisma's defaults are 2 s to get a
    // connection and 5 s for everything after, which a burst on one org eats
    // through. These numbers are what stops that happening, and they stay
    // inside a serverless function's own budget so a request that does blow
    // through returns an answer rather than being killed mid-write.
    //
    // Prisma's `timeout` does not cancel a statement already blocked in
    // Postgres: a waiter sits on the lock for as long as the holder holds it
    // and finds its transaction expired on the NEXT statement, so the failure
    // arrives as `P2028` once the lock is finally granted. `fail` turns that
    // into `BUSY_MESSAGE` — never into the at-cap sentence, which would be a
    // lie to an owner with slots to spare.
    const lockKey = `agentrule:${ctx.org.id}`;
    const rule = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const live = await tx.agentRule.count({
        where: { orgId: ctx.org.id, status: "active" },
      });
      if (live >= limit) return null;

      // New rules go last. Archived rows count towards the highest order so
      // that restoring one later cannot collide with a live rule's position.
      const last = await tx.agentRule.findFirst({
        where: { orgId: ctx.org.id },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      return tx.agentRule.create({
        data: {
          orgId: ctx.org.id,
          text: draft.text,
          instruction,
          scope: draft.scope,
          condition: draft.condition ?? null,
          status: "active",
          source: "owner",
          order: (last?.order ?? -1) + 1,
        },
      });
    }, TRANSACTION_OPTIONS);
    // The loser of a race gets the same sentence as the owner who was already
    // full — from their side nothing else happened.
    if (!rule) return { ok: false, message: atCapMessage(limit) };

    recordAudit(ctx, "rule.created", rule.id);
    revalidatePath("/agent");
    return { ok: true, message: "Rule added — your AI follows it from the next reply." };
  } catch (err) {
    return fail(err);
  }
}

export async function updateRuleAction(
  id: string,
  text: string,
  scope: string,
  condition?: string
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");

    const parsed = parseDraft({ text, scope, condition });
    if (!parsed.ok) return { ok: false, message: parsed.message };
    const draft = parsed.draft;

    if (widensRule(draft)) {
      return { ok: false, message: SCOPE_WIDENING_MESSAGE };
    }

    // Org-scoped read before the write (invariant #5): another workspace's id
    // must find nothing, and must not cost a model call on the way.
    const existing = await prisma.agentRule.findFirst({
      where: { id, orgId: ctx.org.id },
      select: { id: true },
    });
    if (!existing) return { ok: false, message: "That rule no longer exists." };

    const { instruction } = await distillRule({
      orgId: ctx.org.id,
      text: draft.text,
      scope: draft.scope,
      condition: draft.condition,
    });

    // `source` and `status` are deliberately absent: editing the wording of a
    // migrated rule must not relabel where it came from, or revive an archived
    // one. That absence is also why this action needs no cap guard — it can
    // never turn an archived row active, so it cannot push an org over the
    // limit. `archiveRuleAction` only ever moves the count down. The one write
    // that does move it up is `restoreRuleAction`, which takes the same guarded
    // write as `createRuleAction`.
    await prisma.agentRule.update({
      where: { id: existing.id },
      data: {
        text: draft.text,
        instruction,
        scope: draft.scope,
        condition: draft.condition ?? null,
      },
    });

    recordAudit(ctx, "rule.updated", existing.id);
    revalidatePath("/agent");
    return { ok: true, message: "Rule updated." };
  } catch (err) {
    return fail(err);
  }
}

/** Archived, never deleted — mirrors `KnowledgeEntry`, so nothing is lost. */
export async function archiveRuleAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const updated = await prisma.agentRule.updateMany({
      where: { id, orgId: ctx.org.id, status: "active" },
      data: { status: "archived" },
    });
    if (updated.count === 0) return { ok: false, message: "That rule no longer exists." };

    recordAudit(ctx, "rule.archived", id);
    revalidatePath("/agent");
    return { ok: true, message: "Rule archived — your AI stops following it now." };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Drag-to-reorder: `order` becomes the position in `ids`.
 *
 * Every write carries the org filter, so an id from another workspace updates
 * nothing. That is deliberately a no-op rather than a failure: the list is
 * dragged as a whole, and a single stale id (a rule archived in another tab)
 * should not throw away the owner's whole rearrangement.
 */
export async function reorderRulesAction(ids: string[]): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))].slice(
      0,
      MAX_ACTIVE_RULES.full
    );
    if (unique.length === 0) return { ok: false, message: "Nothing to reorder." };

    await prisma.$transaction(
      unique.map((id, index) =>
        prisma.agentRule.updateMany({
          where: { id, orgId: ctx.org.id },
          data: { order: index },
        })
      )
    );

    recordAudit(ctx, "rule.updated", undefined, `Reordered ${unique.length} rules`);
    revalidatePath("/agent");
    return { ok: true, message: "Order saved." };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Archived → active: the way back from `archiveRuleAction`, and the only other
 * write in this file that can move the active count UP.
 *
 * So it takes the same per-org advisory lock and re-counts inside the write
 * that `createRuleAction` does, for the same reason: counting outside the write
 * is check-then-act, and two restores (or a restore racing an Add) would both
 * read `live < limit` and both commit, leaving the org over its cap. An owner
 * who loses that race is told exactly what an owner who was already full is
 * told — from their side nothing else happened.
 *
 * There is no early exit before the transaction: unlike `createRuleAction` a
 * restore has no model call to save, so a second count outside the lock would
 * buy nothing and could only disagree with the one that matters.
 *
 * `order` is left alone. A restored rule returns to the position it held,
 * which cannot collide with a live rule because `createRuleAction` numbers new
 * rules past every row the org has, archived ones included.
 */
export async function restoreRuleAction(id: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  try {
    requireRole(ctx, "ADMIN");
    const limit = await ruleLimitFor(ctx.org.id);

    const lockKey = `agentrule:${ctx.org.id}`;
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const live = await tx.agentRule.count({
        where: { orgId: ctx.org.id, status: "active" },
      });
      if (live >= limit) return "at_cap" as const;

      // `status: "archived"` in the filter makes this idempotent: a rule some
      // other tab already restored updates nothing and consumes no slot.
      const updated = await tx.agentRule.updateMany({
        where: { id, orgId: ctx.org.id, status: "archived" },
        data: { status: "active" },
      });
      return updated.count === 0 ? ("missing" as const) : ("restored" as const);
    }, TRANSACTION_OPTIONS);

    if (outcome === "at_cap") return { ok: false, message: atCapMessage(limit) };
    if (outcome === "missing") return { ok: false, message: "That rule no longer exists." };

    recordAudit(ctx, "rule.restored", id);
    revalidatePath("/agent");
    return { ok: true, message: "Rule restored — your AI follows it again from the next reply." };
  } catch (err) {
    return fail(err);
  }
}

/**
 * One sentence, used by both the early exit and the guard inside the write, so
 * an owner who loses a race cannot be told something different from an owner
 * who was simply full. Changing it changes what both say.
 */
function atCapMessage(limit: number): string {
  return `You can have ${limit} active rules at a time — the AI follows a short list far more reliably than a long one. Archive one to make room.`;
}

/** The scope guard reads the condition too — "when they ask about any topic". */
function widensRule(draft: { text: string; condition?: string }): boolean {
  return widensScope(draft.text) || (!!draft.condition && widensScope(draft.condition));
}

type ParsedDraft =
  | { ok: true; draft: { text: string; scope: RuleScope; condition?: string } }
  | { ok: false; message: string };

/**
 * `ruleSchema` validates a whole stored rule, but the distiller has not run
 * yet — so the owner's own sentence stands in for the instruction it is about
 * to produce. That is exactly `distillRule`'s own fallback, so anything that
 * passes here is storable whatever the model returns, and an invalid rule is
 * refused before it costs a model call.
 */
function parseDraft(input: {
  text: string;
  scope: string;
  condition?: string;
}): ParsedDraft {
  const condition = input.condition?.trim();
  const parsed = ruleSchema.safeParse({
    text: input.text,
    instruction: input.text.trim().slice(0, MAX_INSTRUCTION_LENGTH),
    scope: input.scope,
    condition: condition || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: ruleErrorMessage(parsed.error, input.scope) };
  }
  const { text, scope, condition: parsedCondition } = parsed.data;
  return { ok: true, draft: { text, scope, condition: parsedCondition } };
}

/**
 * Owner-facing sentence for a rule that failed validation. The raw zod message
 * is precise and unreadable, and it names field paths the owner never sees —
 * so it is matched on the failing field and reworded as what that field needs.
 */
function ruleErrorMessage(error: ZodError, scope: string): string {
  const leaf = error.issues[0]?.path.at(-1);
  if (leaf === "text" || leaf === "instruction") {
    return `Write the rule as a sentence or two, up to ${MAX_RULE_TEXT_LENGTH} characters.`;
  }
  if (leaf === "scope") {
    return "Choose whether this rule always applies, never applies, or applies in one situation.";
  }
  if (leaf === "condition") {
    return scope === "when"
      ? 'Say when this rule applies — for example "someone asks about pricing".'
      : "Only a rule for one situation takes a situation — leave it blank.";
  }
  return "That rule isn't valid — try rewording it.";
}
