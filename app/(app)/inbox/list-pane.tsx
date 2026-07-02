"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Inbox as InboxIcon, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  INBOX_FILTERS,
  INBOX_FILTER_LABELS,
  type InboxFilter,
} from "@/lib/inbox/filters";
import { formatRelativeTime, serviceWindowState } from "@/lib/inbox/format";
import type { ConversationSummary } from "@/lib/inbox/queries";
import { useInboxPoll, useNow } from "./use-inbox-poll";

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
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="border-b border-neutral-100 p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, message…"
            aria-label="Search conversations"
            className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-900 outline-none transition-colors duration-150 placeholder:text-neutral-400 focus-visible:border-brand-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-brand-400/50"
          />
        </div>
        <div
          role="tablist"
          aria-label="Conversation filters"
          className="no-scrollbar -mx-3 mt-2.5 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {INBOX_FILTERS.map((f) => (
            <Link
              key={f}
              role="tab"
              aria-selected={f === filter}
              href={inboxHref("/inbox", f, q)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50 sm:px-2.5 sm:py-1",
                f === filter
                  ? "bg-brand-600 text-white"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
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
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
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
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ul className="divide-y divide-neutral-100">
        {conversations.map((c) => {
          const win = serviceWindowState(c.lastInboundAt, now);
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <Link
                href={inboxHref(`/inbox/${c.id}`, filter, q)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3 px-3 py-3 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50",
                  active ? "bg-brand-50/70" : "hover:bg-neutral-50"
                )}
              >
                <Avatar name={c.contact.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm text-neutral-900",
                        c.unreadCount > 0 ? "font-semibold" : "font-medium"
                      )}
                    >
                      {c.contact.name}
                    </p>
                    <span
                      className="shrink-0 text-xs text-neutral-400"
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(c.lastMessageAt, now)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs",
                        c.unreadCount > 0
                          ? "font-medium text-neutral-700"
                          : "text-neutral-500"
                      )}
                    >
                      {c.lastMessagePreview ?? "No messages yet"}
                    </p>
                    {c.unreadCount > 0 && (
                      <span
                        aria-label={`${c.unreadCount} unread`}
                        className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white"
                      >
                        {c.unreadCount > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
                    {c.status === "handoff" && (
                      <Badge tone="warning">Needs human</Badge>
                    )}
                    {(c.status === "resolved" || c.status === "closed") && (
                      <Badge tone="neutral">Resolved</Badge>
                    )}
                    {c.status === "pending" && <Badge tone="info">Pending</Badge>}
                    {win.open && (
                      <Badge tone="brand">
                        <Clock className="h-3 w-3" aria-hidden />
                        <span suppressHydrationWarning>{win.label}</span>
                      </Badge>
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
