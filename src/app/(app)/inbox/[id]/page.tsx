import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrgContext } from "@/modules/orgs/auth";
import { parseInboxFilter } from "@/modules/inbox/filters";
import {
  getThreadSnapshot,
  listConversationSummaries,
} from "@/modules/inbox/queries";
import { getApprovedTemplates } from "@/modules/whatsapp/library";
import { PageHeader } from "@/components/ui/page-header";
import { ListPane } from "../list-pane";
import { ThreadPane } from "./thread";
import { ContextPanel, type ContextPanelProps } from "./context-panel";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const [{ org, userId }, { id }, sp] = await Promise.all([
    requireOrgContext(),
    params,
    searchParams,
  ]);
  const filter = parseInboxFilter(sp.filter);
  const q = sp.q ?? "";

  // One parallel batch instead of three serial round-trips to the DB — the
  // thread snapshot and list are keyed off `id`/`org.id`, so nothing here
  // depends on another query's result. Marking the thread read rides along
  // (the active thread is highlighted regardless, so any list staleness is
  // invisible). This is the main win for slow chat opens.
  const [, conversation, summaries, snapshot, orgTags, memberships, templates] =
    await Promise.all([
      prisma.conversation.updateMany({
        where: { id, orgId: org.id },
        data: { unreadCount: 0 },
      }),
      prisma.conversation.findFirst({
        where: { id, orgId: org.id },
        include: {
          contact: { include: { tags: { include: { tag: true } } } },
          notes: { orderBy: { createdAt: "desc" }, take: 50 },
          tags: { include: { tag: true } },
        },
      }),
      listConversationSummaries(org.id, filter, q, userId),
      getThreadSnapshot(id, org.id),
      prisma.tag.findMany({ where: { orgId: org.id }, orderBy: { name: "asc" } }),
      prisma.membership.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: "asc" },
      }),
      getApprovedTemplates(org.id),
    ]);
  if (!conversation) notFound();
  if (!snapshot) notFound();

  const contact = conversation.contact;
  const backHref = (() => {
    const p = new URLSearchParams();
    if (filter !== "open") p.set("filter", filter);
    if (q.trim()) p.set("q", q.trim());
    const qs = p.toString();
    return `/inbox${qs ? `?${qs}` : ""}`;
  })();

  const panelProps: ContextPanelProps = {
    conversationId: conversation.id,
    status: conversation.status,
    assignedToUserId: conversation.assignedToUserId,
    lastInboundAt: conversation.lastInboundAt?.toISOString() ?? null,
    contact: {
      id: contact.id,
      name: contact.name,
      phoneE164: contact.phoneE164,
      email: contact.email,
      optedIn: contact.optedIn,
      optedOut: contact.optedOutAt !== null,
      leadStage: contact.leadStage,
      optInSource: contact.optInSource,
      createdAt: contact.createdAt.toISOString(),
    },
    contactTags: contact.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    })),
    orgTags: orgTags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    members: memberships.map((m) => ({
      userId: m.userId,
      name: m.displayName ?? m.email,
    })),
    notes: conversation.notes.map((n) => ({
      id: n.id,
      authorName: n.authorName,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every WhatsApp conversation in one shared team inbox."
        className="hidden lg:flex"
      />
      <div className="grid h-[calc(100dvh-6.5rem)] min-h-[26rem] grid-cols-1 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft lg:h-[calc(100dvh-12.5rem)] lg:grid-cols-[minmax(280px,20rem)_1fr] xl:grid-cols-[minmax(280px,20rem)_minmax(0,1fr)_minmax(250px,18.5rem)]">
        <ListPane
          initial={summaries}
          filter={filter}
          q={q}
          activeId={conversation.id}
          className="hidden border-neutral-100 lg:flex lg:border-r"
        />
        <ThreadPane
          key={conversation.id}
          conversationId={conversation.id}
          initial={snapshot}
          contactName={contact.name}
          contactPhone={contact.phoneE164}
          conversationStatus={conversation.status}
          templates={templates}
          simulation={env.SEND_MODE === "simulation"}
          backHref={backHref}
          panel={panelProps}
        />
        <div className="hidden min-h-0 overflow-y-auto border-l border-neutral-100 xl:block">
          <ContextPanel {...panelProps} />
        </div>
      </div>
    </>
  );
}
