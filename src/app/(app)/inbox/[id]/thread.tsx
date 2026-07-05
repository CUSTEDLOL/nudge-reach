"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import type { LibraryTemplate } from "@/modules/whatsapp/library";
import {
  dayKey,
  firstName,
  formatDayLabel,
  formatMessageTime,
  serviceWindowState,
} from "@/modules/inbox/format";
import type { ThreadSnapshot } from "@/modules/inbox/queries";
import { useInboxPoll, useNow } from "../use-inbox-poll";
import { Composer } from "./composer";
import { ContextPanel, type ContextPanelProps } from "./context-panel";
import { SimTester } from "./sim-tester";

/**
 * Middle pane: thread header + message bubbles (day separators, ticks) +
 * composer, polling /api/inbox/[id]/messages so inbound messages appear live.
 */
export function ThreadPane({
  conversationId,
  initial,
  contactName,
  contactPhone,
  conversationStatus,
  templates,
  simulation,
  backHref,
  panel,
}: {
  conversationId: string;
  initial: ThreadSnapshot;
  contactName: string;
  contactPhone: string;
  conversationStatus: string;
  templates: LibraryTemplate[];
  simulation: boolean;
  backHref: string;
  panel: ContextPanelProps;
}) {
  // The page keys this component by conversation id, so `initial` is the
  // snapshot for exactly this thread; polling keeps it fresh afterwards.
  const [snapshot, setSnapshot] = useState(initial);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(-1);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/inbox/${conversationId}/messages`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    setSnapshot((await res.json()) as ThreadSnapshot);
  }, [conversationId]);

  useInboxPoll(refresh);

  // Re-evaluate the 24h window every 30s even without new messages.
  const now = useNow(30_000);
  const win = serviceWindowState(snapshot.lastInboundAt, now);

  // Stick to the bottom on load and when new messages arrive (unless the
  // reader has scrolled up into history).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isFirst = lastCountRef.current === -1;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (isFirst || nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = snapshot.messages.length;
  }, [snapshot.messages.length]);

  const status = snapshot.status || conversationStatus;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <Link
          href={backHref}
          aria-label="Back to inbox"
          className="rounded-lg p-1.5 text-neutral-500 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-400/50 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <Avatar name={contactName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {contactName}
          </p>
          <p className="truncate font-mono text-xs text-neutral-400">
            {contactPhone}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Status badges hide below sm so the contact name keeps room —
              the same status lives in the details drawer and the list. */}
          {status === "handoff" && (
            <Badge tone="warning" className="max-sm:hidden">
              Needs human
            </Badge>
          )}
          {status === "pending" && (
            <Badge tone="info" className="max-sm:hidden">
              Pending
            </Badge>
          )}
          {(status === "resolved" || status === "closed") && (
            <Badge tone="neutral" className="max-sm:hidden">
              Resolved
            </Badge>
          )}
          {win.open ? (
            <Badge tone="brand">
              <Clock className="h-3 w-3" aria-hidden />
              <span suppressHydrationWarning>{win.label}</span>
            </Badge>
          ) : (
            <Badge tone="neutral" aria-label="Service window closed">
              <Clock className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Window closed</span>
              <span className="sm:hidden">Closed</span>
            </Badge>
          )}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-label="Conversation details"
            className="rounded-lg p-1.5 text-neutral-500 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-brand-400/50 xl:hidden"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/60 px-4 py-4"
      >
        {snapshot.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            No messages yet.
            {simulation && " Use “Test as customer” below to start the thread."}
          </p>
        ) : (
          <MessageList messages={snapshot.messages} />
        )}
      </div>

      {/* Sim tester (simulation mode only) */}
      {simulation && (
        <SimTester
          conversationPhone={contactPhone}
          onPosted={refresh}
        />
      )}

      {/* Composer */}
      <Composer
        conversationId={conversationId}
        windowOpen={win.open}
        contactFirstName={firstName(contactName)}
        contactName={contactName}
        templates={templates}
        onSent={refresh}
      />

      {/* Context panel drawer for < xl screens */}
      <Drawer
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Details"
        description={contactName}
        width="sm"
      >
        <ContextPanel {...panel} unpadded />
      </Drawer>
    </div>
  );
}

function MessageList({
  messages,
}: {
  messages: ThreadSnapshot["messages"];
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5">
      {messages.map((m, i) => {
        const showSeparator =
          i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1].createdAt);
        const inbound = m.direction === "inbound";
        return (
          <Fragment key={m.id}>
            {showSeparator && (
              <div className="my-2 flex items-center gap-3">
                <span className="h-px flex-1 bg-neutral-200/70" aria-hidden />
                <span
                  className="text-xs font-medium text-neutral-400"
                  suppressHydrationWarning
                >
                  {formatDayLabel(m.createdAt)}
                </span>
                <span className="h-px flex-1 bg-neutral-200/70" aria-hidden />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                inbound
                  ? "self-start rounded-tl-sm border border-neutral-100 bg-white text-neutral-800"
                  : "self-end rounded-tr-sm bg-brand-100/80 text-brand-950"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                  inbound ? "text-neutral-400" : "text-brand-700/70"
                )}
              >
                <span suppressHydrationWarning>
                  {formatMessageTime(m.createdAt)}
                </span>
                {!inbound && m.metaMessageId && (
                  <Check className="h-3 w-3" aria-label="Sent" />
                )}
              </p>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
