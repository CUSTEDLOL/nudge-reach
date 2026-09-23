import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AutoReplySwitch } from "./auto-reply-switch";
import { BusinessSection } from "./business-section";
import { RulesSection } from "./rules-section";
import { SectionHeader } from "./section-header";
import { Queue, type QueueItem } from "./queue";
import { Library, type LibraryFact } from "./library";
import { ImportPanel } from "./import-panel";
import { parseWaiting } from "@/modules/knowledge/questions";
import { migrateProfileOnce } from "@/modules/agent/migrate-profile";
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
import { TrialKnowledgeSources } from "@/components/features/trial/trial-knowledge-sources";
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
  // The old Setup page's two free-text boxes become rules and draft facts, once
  // per org, before the reads below — so the first sight of this page already
  // shows what the owner typed there. Guarded and failure-swallowing.
  //
  // It stays ahead of the `Promise.all` rather than joining it: this WRITES the
  // rules and drafts those reads select, so running them together would race,
  // and the first render is exactly the one that would lose. The cost is one
  // indexed `findFirst` on a cold load and nothing at all once the instance has
  // seen this org.
  await migrateProfileOnce(ctx.org.id);
  const trial = await getTrialWorkspace(ctx.org.id);
  const onTrial = trial !== null && !trial.converted;
  const ruleLimit = onTrial ? MAX_ACTIVE_RULES.trial : MAX_ACTIVE_RULES.full;

  const [questions, facts, drafts, profile, ruleRows, migratedRule] = await Promise.all([
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
    // Has `migrateProfileToRules` already carried this org's legacy blob over?
    // Its own durable guard is this exact row, so asking for it is asking the
    // same question the migration asks itself — and it is the only honest
    // signal, since the migration writes drafts the fact list below cannot see.
    prisma.agentRule.findFirst({
      where: { orgId: ctx.org.id, source: { startsWith: "migrated_" } },
      select: { id: true },
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

  // "Structure my existing info" re-distills `AgentProfile.businessInfo` into
  // facts, so it has to retire once that blob has been structured by ANY route.
  // It used to test only active facts with `source: "import"` — which the
  // migration never writes (it files `source: "manual"`, `status: "draft"`) —
  // so the card showed on every migrated org forever, and each press produced a
  // second, differently-worded copy of what the migration had already queued.
  // `migrated_…` is the migration's own guard row; `concierge` facts are the
  // same six fields the blob was built from, written by client setup.
  const alreadyStructured =
    migratedRule !== null ||
    facts.some((f) => f.source === "import" || f.source === "concierge");
  const showStructureButton =
    Boolean(profile?.businessInfo.trim()) && !alreadyStructured;
  // An empty library has no count worth showing.
  const taught = facts.length > 0;

  // The one coloured element on the page, and only when there is something
  // in it: an empty queue is nothing to look at, not a box saying so.
  const queueBand =
    queueItems.length > 0 ? (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-brand-900">
          {queueItems.length === 1
            ? "1 question is waiting for you"
            : `${queueItems.length} questions are waiting for you`}
        </h3>
        <Queue items={queueItems} canEdit={canEdit} />
      </div>
    ) : null;
  // `id="library"` is where the questionnaire's "back to Training" link lands.
  const library = (
    <div id="library">
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
          actions={
            <>
              {profile?.enabled && canEdit && <AutoReplySwitch />}
              <Link href="/inbox/try" className={buttonVariants({ size: "sm" })}>
                Try it in chat
              </Link>
            </>
          }
        />
      )}

      <div className="flex flex-col gap-6">
        {!onTrial && profile && !profile.enabled && (
          <AiOffNotice canEdit={canEdit} />
        )}

        {/* Two columns from lg: rules and facts fill the left, the rail on the
            right holds the business and where facts come from. The rail is
            FIRST in the DOM and ordered last on desktop, so on a phone the
            import box sits at the top rather than below every fact. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <aside
            className="flex flex-col gap-4 lg:order-last"
            aria-label="Business and sources"
          >
            <BusinessSection
              canEdit={canEdit}
              businessName={profile?.businessName ?? ""}
              // No profile yet: start the picker on the answer they already gave
              // at onboarding rather than on whatever the list happens to open on.
              vertical={profile?.vertical ?? ctx.org.vertical ?? "other"}
              tone={profile?.tone ?? ""}
            />
            {/* Where facts come from, for both kinds of workspace: the paid
                importer, or the trial's own sources at the trial's allowances.
                The trial's used to render down in the left column inside
                TrialTraining, which left the rail nearly empty and pushed the
                upload box below every fact. Its draft review stays there. */}
            {trial && onTrial ? (
              <TrialKnowledgeSources
                canEdit={canEdit}
                webImportsUsed={trial.webImportsUsed}
                webImportLimit={trial.webImportLimit}
                fileImportsUsed={trial.fileImportsUsed}
                fileImportLimit={trial.fileImportLimit}
              />
            ) : (
              <ImportPanel
                canEdit={canEdit}
                drafts={drafts.map((d) => ({
                  id: d.id,
                  category: d.category,
                  fact: d.fact,
                  condition: d.condition,
                }))}
              />
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-8">
            <RulesSection rules={rules} canEdit={canEdit} limit={ruleLimit} />

            {/* The trial's tour anchors its Training step on the "Approved facts"
                section inside TrialTraining — one anchor only, because the tour
                looks it up with a single-element query. */}
            <section aria-labelledby="training-knowledge-heading">
              <SectionHeader
                id="training-knowledge-heading"
                title="What it knows"
                // The trial counts its own facts inside TrialTraining ("Facts
                // 3/50", drafts included); a second number here would contradict it.
                meta={
                  !onTrial && taught
                    ? `${facts.length} fact${facts.length === 1 ? "" : "s"}`
                    : undefined
                }
                action={
                  !onTrial && (
                    <Link
                      href="/agent/questionnaire"
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Questionnaire
                    </Link>
                  )
                }
              />
              <div className="flex flex-col gap-4">
                {trial && onTrial ? (
                  <TrialTraining
                    workspace={trial}
                    canEdit={canEdit}
                    facts={libraryFacts}
                    drafts={drafts}
                  />
                ) : (
                  <>
                    {queueBand}
                    {library}
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {"It only ever says what's in here."}
              </p>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
