import type { Metadata } from "next";
import Link from "next/link";
import { Bot, MessageSquare } from "lucide-react";
import { requireOrgContext } from "@/modules/orgs/auth";
import { parseInboxFilter } from "@/modules/inbox/filters";
import { listConversationSummaries } from "@/modules/inbox/queries";
import { creditsExhausted } from "@/modules/billing/credits";
import { buttonVariants } from "@/components/ui/button";
import { CreditBanner } from "@/components/features/credit-banner";
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
  const aiPaused = await creditsExhausted(org.id);

  return (
    <>
      {aiPaused && <CreditBanner />}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[clamp(300px,32%,420px)_minmax(0,1fr)]">
        <ListPane
          initial={conversations}
          filter={filter}
          q={q}
          className="border-[#e9edef] lg:border-r"
        />
        <div className="hidden flex-col items-center justify-center gap-4 border-b-[6px] border-[#25d366] bg-[#f0f2f5] px-6 text-center lg:flex">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#00a884] shadow-sm">
            {conversations.length === 0 ? (
              <Bot className="h-9 w-9" aria-hidden />
            ) : (
              <MessageSquare className="h-9 w-9" aria-hidden />
            )}
          </span>
          <div>
            <h2 className="text-[28px] font-light text-[#41525d]">
              {conversations.length === 0
                ? "See your AI answer"
                : "Nudge Inbox"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#667781]">
              {conversations.length === 0
                ? "Message your business as a customer would — the reply lands right here."
                : "Every WhatsApp conversation in one shared team inbox. Pick a chat on the left to read it, reply, and manage the contact."}
            </p>
          </div>
          {conversations.length === 0 && (
            <Link href="/inbox/try" className={buttonVariants({ size: "sm" })}>
              Try your AI
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
