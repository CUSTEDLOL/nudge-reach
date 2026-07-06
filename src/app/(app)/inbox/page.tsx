import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { parseInboxFilter } from "@/modules/inbox/filters";
import { listConversationSummaries } from "@/modules/inbox/queries";
import { PageHeader } from "@/components/ui/page-header";
import { ListPane } from "./list-pane";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const [{ org, userId }, params] = await Promise.all([
    requireOrgContext(),
    searchParams,
  ]);
  const filter = parseInboxFilter(params.filter);
  const q = params.q ?? "";

  const conversations = await listConversationSummaries(
    org.id,
    filter,
    q,
    userId
  );

  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every WhatsApp conversation in one shared team inbox."
      />
      {/* Mobile subtracts extra chrome for the fixed bottom nav. */}
      <div className="grid h-[calc(100dvh-16rem-env(safe-area-inset-bottom))] min-h-[24rem] grid-cols-1 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft lg:h-[calc(100dvh-12.5rem)] lg:min-h-[26rem] lg:grid-cols-[minmax(300px,22rem)_1fr]">
        <ListPane
          initial={conversations}
          filter={filter}
          q={q}
          className="border-neutral-100 lg:border-r"
        />
        <div className="hidden flex-col items-center justify-center gap-3 bg-neutral-50/60 px-6 text-center lg:flex">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MessageSquare className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Select a conversation
            </h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-neutral-500">
              Pick a thread on the left to read it, reply, and manage the
              contact.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
