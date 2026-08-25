import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { hasRole, requireOrgContext } from "@/modules/orgs/auth";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Queue, type QueueItem } from "./queue";
import { Library, type LibraryFact } from "./library";
import { ImportPanel } from "./import-panel";
import { AgentForm, type AgentFormValues } from "./agent-form";
import { AgentTabs } from "./agent-tabs";
import { parseWaiting } from "@/modules/knowledge/questions";

export const metadata: Metadata = { title: "AI Agent" };

/**
 * Everything about the AI employee in one place. Two tabs:
 *  - Training (default): the questions it's waiting on + the fact library.
 *  - Setup: persona — on/off, tone, business info, do-nots.
 * The old /knowledge and /settings/agent routes 301 here.
 */
export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [ctx, { tab }] = await Promise.all([requireOrgContext(), searchParams]);
  const canEdit = hasRole(ctx.role, "ADMIN");

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

  const setupInitial: AgentFormValues = {
    enabled: profile?.enabled ?? false,
    vertical: profile?.vertical ?? "restaurant",
    businessName: profile?.businessName ?? ctx.org.name,
    businessInfo: profile?.businessInfo ?? "",
    tone: profile?.tone ?? "Warm, friendly, and concise",
    doNots: profile?.doNots ?? "",
  };

  return (
    <section>
      <PageHeader
        title="AI Agent"
        description="Your AI employee — what it knows, the questions it's waiting on, and how it behaves on WhatsApp."
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

      <AgentTabs
        initialTab={tab}
        pendingCount={queueItems.length}
        training={
          <div className="flex flex-col gap-8">
            <ImportPanel
              canEdit={canEdit}
              drafts={drafts.map((d) => ({
                id: d.id,
                category: d.category,
                fact: d.fact,
                condition: d.condition,
              }))}
            />
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
        }
        setup={
          <div>
            <Card className="p-6">
              <AgentForm initial={setupInitial} />
            </Card>
            <p className="mt-4 text-sm text-neutral-500">
              Test it from the{" "}
              <Link
                href="/inbox"
                className="font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                Inbox
              </Link>{" "}
              — in simulation mode you can send an inbound message as the
              customer.
            </p>
          </div>
        }
      />
    </section>
  );
}
