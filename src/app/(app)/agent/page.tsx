import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Queue, type QueueItem } from "./queue";
import { Library, type LibraryFact } from "./library";
import { ImportPanel } from "./import-panel";
import { parseWaiting } from "@/modules/knowledge/questions";
import { AiOffNotice } from "@/components/features/front-desk/ai-off-notice";
import { TrialTraining } from "@/components/features/trial/trial-training";
import { getTrialWorkspace } from "@/modules/trial/workspace";

export const metadata: Metadata = { title: "AI Front Desk" };

/**
 * Training: the recurring work on the AI employee — import what it should
 * know, answer the questions it is waiting on, tend the fact library. The
 * set-once persona lives on its own page at /agent/setup. The old /knowledge
 * and /settings/agent routes 301 into these two.
 */
export default async function AgentPage() {
  const ctx = await requireOrgContext();
  const canEdit = hasRole(ctx.role, "ADMIN");
  const trial = await getTrialWorkspace(ctx.org.id);

  if (trial && !trial.converted) {
    const facts = await prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.org.id, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return (
      <TrialTraining
        canEdit={canEdit}
        source={trial.knowledgeSource}
        setupComplete={trial.setupComplete}
        facts={facts.map((fact) => ({
          id: fact.id,
          category: fact.category,
          fact: fact.fact,
          condition: fact.condition,
          source: fact.source,
        }))}
      />
    );
  }

  const [questions, facts, drafts, profile] = await Promise.all([
    prisma.ownerQuestion.findMany({
      where: { orgId: ctx.org.id, status: "pending" },
      orderBy: { askedAt: "asc" },
      take: 100,
    }),
    prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.org.id, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.knowledgeEntry.findMany({
      where: { orgId: ctx.org.id, status: "draft" },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.agentProfile.findUnique({ where: { orgId: ctx.org.id } }),
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
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">
        Needs your answer
        {queueItems.length > 0 && (
          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700">
            {queueItems.length}
          </span>
        )}
      </h2>
      <Queue items={queueItems} canEdit={canEdit} />
    </div>
  );
  const library = (
    <div id="library">
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">
        {taught ? `Your AI knows ${facts.length} fact${facts.length === 1 ? "" : "s"}` : "Fact library"}
      </h2>
      <Library
        facts={libraryFacts}
        canEdit={canEdit}
        showStructureButton={showStructureButton}
      />
    </div>
  );

  return (
    <section>
      <PageHeader
        title="Training"
        description="What your AI Front Desk knows, and the questions it's waiting on you to answer."
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

      <div className="flex flex-col gap-8">
        {profile && !profile.enabled && <AiOffNotice canEdit={canEdit} />}
        {taught ? (
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
  );
}
