import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/cn";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { BusinessSection } from "./business-section";
import { RulesSection } from "./rules-section";
import { Queue, type QueueItem } from "./queue";
import { Library, type LibraryFact } from "./library";
import { ImportPanel } from "./import-panel";
import { parseWaiting } from "@/modules/knowledge/questions";
import {
  MAX_ACTIVE_RULES,
  toRuleScope,
  type RuleListItem,
} from "@/modules/agent/rules";
import { AiOffNotice } from "@/components/features/front-desk/ai-off-notice";
import {
  TrialTraining,
  TrialTrainingHeader,
} from "@/components/features/trial/trial-training";
import { getTrialWorkspace } from "@/modules/trial/workspace";

export const metadata: Metadata = { title: "AI Front Desk" };

/**
 * Training: the one page that configures the AI employee, in the order the
 * prompt reads it — who it is, how it must behave, then what it knows.
 *
 * The free trial and the full app render the SAME three sections; only the
 * trial's own chrome (its title, its import allowances, its 50-fact ceiling)
 * differs. There used to be a second page, /agent/setup, and owners could not
 * tell which of the two changed the AI's behaviour.
 */
export default async function AgentPage() {
  const ctx = await requireOrgContext();
  const canEdit = hasRole(ctx.role, "ADMIN");
  const trial = await getTrialWorkspace(ctx.org.id);
  const onTrial = trial !== null && !trial.converted;
  const ruleLimit = onTrial ? MAX_ACTIVE_RULES.trial : MAX_ACTIVE_RULES.full;

  const [questions, facts, drafts, profile, ruleRows] = await Promise.all([
    // The trial has no owner-question queue, so it does not pay for the read.
    onTrial
      ? []
      : prisma.ownerQuestion.findMany({
          where: { orgId: ctx.org.id, status: "pending" },
          orderBy: { askedAt: "asc" },
          take: 100,
        }),
    prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.org.id, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        category: true,
        fact: true,
        condition: true,
        source: true,
      },
    }),
    prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.org.id, status: "draft" },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: { id: true, category: true, fact: true, condition: true },
    }),
    prisma.agentProfile.findUnique({ where: { orgId: ctx.org.id } }),
    // Exactly the rules the reply path will carry, in the owner's order.
    prisma.agentRule.findMany({
      where: { orgId: ctx.org.id, status: "active" },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: ruleLimit,
      select: { id: true, text: true, scope: true, condition: true },
    }),
  ]);

  const queueItems: QueueItem[] = questions.map((q) => ({
    id: q.id,
    question: q.question,
    askCount: q.askCount,
    waitingCount: parseWaiting(q.waiting).filter((w) => !w.followedUpAt).length,
    askedAt: q.askedAt.toISOString(),
  }));

  const libraryFacts: LibraryFact[] = facts.map((f) => ({
    id: f.id,
    category: f.category,
    fact: f.fact,
    condition: f.condition,
    source: f.source,
  }));

  const rules: RuleListItem[] = ruleRows.map((r) => ({
    id: r.id,
    text: r.text,
    // A scope outside the vocabulary can only come from a hand-edited row.
    // Show the rule anyway: one the AI is following must never be invisible.
    scope: toRuleScope(r.scope) ?? "always",
    condition: r.condition,
  }));

  const hasImported = facts.some((f) => f.source === "import");
  const showStructureButton =
    Boolean(profile?.businessInfo.trim()) && !hasImported;
  // Once it knows something, lead with that — the proof of the questionnaire
  // was sitting below an import box and an empty queue.
  const taught = facts.length > 0;

  const importPanel = (
    <ImportPanel
      canEdit={canEdit}
      drafts={drafts.map((d) => ({
        id: d.id,
        category: d.category,
        fact: d.fact,
        condition: d.condition,
      }))}
    />
  );
  const queue = (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        Needs your answer
        {queueItems.length > 0 && (
          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
            {queueItems.length}
          </span>
        )}
      </h3>
      <Queue items={queueItems} canEdit={canEdit} />
    </div>
  );
  const library = (
    <div id="library">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        {taught ? `Your AI knows ${facts.length} fact${facts.length === 1 ? "" : "s"}` : "Fact library"}
      </h3>
      <Library
        facts={libraryFacts}
        canEdit={canEdit}
        showStructureButton={showStructureButton}
      />
    </div>
  );

  return (
    <section>
      {trial && onTrial ? (
        <TrialTrainingHeader workspace={trial} />
      ) : (
        <PageHeader
          title="Training"
          description="How your AI Front Desk behaves, what it knows, and the questions it's waiting on you to answer."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/agent/questionnaire"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Teach it with the questionnaire
              </Link>
              <Link href="/inbox/try" className={buttonVariants({ size: "sm" })}>
                Try it in chat
              </Link>
            </div>
          }
        />
      )}

      <div className={cn("flex flex-col gap-8", onTrial && "max-w-3xl")}>
        {!onTrial && profile && !profile.enabled && (
          <AiOffNotice canEdit={canEdit} />
        )}

        <BusinessSection
          canEdit={canEdit}
          businessName={profile?.businessName ?? ""}
          // No profile yet: start the picker on the answer they already gave
          // at onboarding rather than on whatever the list happens to open on.
          vertical={profile?.vertical ?? ctx.org.vertical ?? "other"}
          tone={profile?.tone ?? ""}
        />

        <RulesSection rules={rules} canEdit={canEdit} limit={ruleLimit} />

        {/* The trial's tour anchors its Training step here. */}
        <section
          data-tour="training-source"
          aria-labelledby="training-knowledge-heading"
        >
          <h2
            id="training-knowledge-heading"
            className="text-sm font-semibold text-neutral-900"
          >
            What it knows
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            The facts your AI is allowed to state. It never makes up anything
            that is not here.
          </p>
          <div className="mt-4 flex flex-col gap-8">
            {trial && onTrial ? (
              <TrialTraining
                workspace={trial}
                canEdit={canEdit}
                facts={libraryFacts}
                drafts={drafts}
              />
            ) : taught ? (
              <>
                {queue}
                {library}
                {importPanel}
              </>
            ) : (
              <>
                {importPanel}
                {queue}
                {library}
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
