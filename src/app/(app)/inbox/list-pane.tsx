"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon, Phone, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  INBOX_FILTERS,
  INBOX_FILTER_LABELS,
  type InboxFilter,
} from "@/modules/inbox/filters";
import { formatRelativeTime } from "@/modules/inbox/format";
import type { ConversationSummary } from "@/modules/inbox/queries";
import { useInboxPoll, useNow } from "./use-inbox-poll";
import { WaAvatar } from "./wa-avatar";

function inboxHref(base: string, filter: InboxFilter, q: string): string {
  const params = new URLSearchParams();
  if (filter !== "open") params.set("filter", filter);
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

/**
 * Left pane: search + filter tabs + the polling conversation list. Rendered
 * by both /inbox and /inbox/[id] (there it highlights the open thread).
 */
export function ListPane({
  initial,
  filter,
  q,
  activeId,
  className,
}: {
  initial: ConversationSummary[];
  filter: InboxFilter;
  q: string;
  activeId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const lastPushedRef = useRef(q);

  // Debounced ?q= sync so the URL stays shareable.
  useEffect(() => {
    if (search === lastPushedRef.current) return;
    const timer = setTimeout(() => {
      lastPushedRef.current = search;
      router.replace(inboxHref("/inbox", filter, search));
    }, 400);
    return () => clearTimeout(timer);
  }, [search, filter, router]);

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-white", className)}>
      <div className="px-4 pb-2 pt-3">
        <h2 className="flex h-11 items-center text-[22px] font-bold text-[#111b21]">
          Chats
        </h2>
        <div className="relative mt-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#54656f]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, message"
            aria-label="Search conversations"
            className="h-10 w-full rounded-full bg-[#f0f2f5] pl-11 pr-4 text-[15px] text-[#111b21] outline-none placeholder:text-[#667781] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#00a884]"
          />
        </div>
        <div
          role="tablist"
          aria-label="Conversation filters"
          className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4"
        >
          {INBOX_FILTERS.map((f) => (
            <Link
              key={f}
              role="tab"
              aria-selected={f === filter}
              href={inboxHref("/inbox", f, q)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[14px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#00a884]",
                f === filter
                  ? "border-[#d9fdd3] bg-[#d9fdd3] font-medium text-[#15603e]"
                  : "border-[#e9edef] text-[#54656f] hover:bg-[#f5f6f6]"
              )}
            >
              {INBOX_FILTER_LABELS[f]}
            </Link>
          ))}
        </div>
      </div>

      {/* Keyed remount on filter/search change resets the polled data to the
          fresh server-rendered list for that query. */}
      <ConversationItems
        key={`${filter}|${q}`}
        initial={initial}
        filter={filter}
        q={q}
        activeId={activeId}
      />
    </div>
  );
}

function ConversationItems({
  initial,
  filter,
  q,
  activeId,
}: {
  initial: ConversationSummary[];
  filter: InboxFilter;
  q: string;
  activeId?: string;
}) {
  const [conversations, setConversations] = useState(initial);
  const now = useNow(30_000);

  const poll = useCallback(async () => {
    const params = new URLSearchParams({ filter });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/inbox/list?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversations: ConversationSummary[];
    };
    setConversations(data.conversations);
  }, [filter, q]);

  useInboxPoll(poll);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d9fdd3] text-[#008069]">
          <InboxIcon className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-medium text-neutral-900">
          {q.trim() ? "No matches" : "No conversations here"}
        </p>
        <p className="text-xs text-neutral-500">
          {q.trim()
            ? "Try a different name, phone number or keyword."
            : filter === "open"
              ? "New customer messages land here automatically."
              : "Nothing matches this filter yet."}
        </p>
        {!q.trim() && filter === "open" && (
          <Link
            href="/inbox/try"
            className="mt-1 text-xs font-semibold text-[#008069] underline-offset-2 hover:underline"
          >
            Try your AI as a customer →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ul>
        {conversations.map((c) => {
          const active = c.id === activeId;
          const unread = c.unreadCount > 0;
          return (
            <li key={c.id}>
              <Link
                href={inboxHref(`/inbox/${c.id}`, filter, q)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[72px] items-center gap-3 pl-3 pr-0 outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a884]",
                  active ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                )}
              >
                <WaAvatar />
                <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-[#e9edef] pr-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[17px] leading-[21px] text-[#111b21]">
                      {c.contact.name}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        unread ? "font-medium text-[#1fa855]" : "text-[#667781]"
                      )}
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(c.lastMessageAt, now)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {c.channel === "voice" && (
                      <Phone
                        className="h-3.5 w-3.5 shrink-0 text-[#667781]"
                        aria-label="Phone call"
                      />
                    )}
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-[14px] leading-5",
                        unread ? "text-[#111b21]" : "text-[#667781]"
                      )}
                    >
                      {c.lastMessagePreview ?? "No messages yet"}
                    </p>
                    {c.status === "handoff" && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                        Needs human
                      </span>
                    )}
                    {unread && (
                      <span
                        aria-label={`${c.unreadCount} unread`}
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[12px] font-semibold text-white"
                      >
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
