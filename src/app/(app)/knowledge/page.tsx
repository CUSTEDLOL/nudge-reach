import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Queue, type QueueItem } from "./queue";
import { Library, type LibraryFact } from "./library";
import { parseWaiting } from "@/modules/knowledge/questions";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  const ctx = await requireOrgContext();
  const canEdit = hasRole(ctx.role, "ADMIN");

  const [questions, facts, profile] = await Promise.all([
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
    prisma.agentProfile.findUnique({
      where: { orgId: ctx.org.id },
      select: { businessInfo: true },
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

  const hasImported = facts.some((f) => f.source === "import");
  const showStructureButton =
    Boolean(profile?.businessInfo.trim()) && !hasImported;

  return (
    <section>
      <PageHeader
        title="Train your AI"
        description="What your AI knows, and the questions it's waiting for you to answer. It gets smarter every time you teach it."
        actions={
          <Link
            href="/knowledge/questionnaire"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Teach it with the questionnaire
          </Link>
        }
      />

      <div className="flex flex-col gap-8">
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

        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">
            Fact library
          </h2>
          <Library
            facts={libraryFacts}
            canEdit={canEdit}
            showStructureButton={showStructureButton}
          />
        </div>
      </div>
    </section>
  );
}
