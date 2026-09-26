"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, PanelRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import type { LibraryTemplate } from "@/modules/whatsapp/library";
import {
  dayKey,
  firstName,
  formatDayLabel,
  formatMessageTime,
  serviceWindowState,
  whatsAppSegments,
} from "@/modules/inbox/format";
import type { ThreadSnapshot } from "@/modules/inbox/queries";
import { useInboxPoll, useNow } from "../use-inbox-poll";
import { Composer } from "./composer";
import { ContextPanel, type ContextPanelProps } from "./context-panel";
import { SimTester } from "./sim-tester";
import { AiPauseToggle } from "./ai-pause-toggle";
import { WaAvatar } from "../wa-avatar";

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
  channel = "whatsapp",
  numberLabel,
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
  /** "whatsapp" | "voice" — voice threads are call transcripts. */
  channel?: string;
  /** E4: shown when the org has more than one number — which number this thread is on. */
  numberLabel?: string | null;
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
  const wide = useIsWide();
  const panelOpen = usePanelPreference();

  function toggleDetails() {
    if (wide) setPanelPreference(!panelOpen);
    else setDetailsOpen(true);
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thread header */}
        <div className="flex h-[60px] shrink-0 items-center gap-2 bg-[#f0f2f5] px-4">
          <Link
            href={backHref}
            aria-label="Back to inbox"
            className="-ml-2 rounded-full p-2 text-[#54656f] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#00a884] lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          {/* Like WhatsApp: the name opens the contact's info. */}
          <button
            type="button"
            onClick={toggleDetails}
            aria-label={`Contact info for ${contactName}`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
          >
            <WaAvatar size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] leading-[21px] text-[#111b21]">
                {contactName}
              </span>
              <span className="block truncate text-[13px] leading-5 text-[#667781]">
                {contactName !== contactPhone
                  ? contactPhone
                  : "click here for contact info"}
              </span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Status chips hide below sm so the contact name keeps room —
                the same status lives in contact info and the list. */}
            {channel === "voice" && <Badge tone="info">Phone call</Badge>}
            {numberLabel && (
              <Badge tone="neutral" className="max-sm:hidden">
                via {numberLabel}
              </Badge>
            )}
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
              <Badge tone="brand" title="Time left to reply freely (WhatsApp 24-hour window)">
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
            {channel === "whatsapp" && (
              <AiPauseToggle
                conversationId={conversationId}
                paused={snapshot.aiPaused}
                onChanged={refresh}
              />
            )}
            <button
              type="button"
              onClick={toggleDetails}
              aria-label="Contact info"
              aria-pressed={wide ? panelOpen : undefined}
              className={cn(
                "rounded-full p-2 text-[#54656f] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#00a884]",
                wide && panelOpen && "bg-black/5"
              )}
            >
              <PanelRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-3 sm:px-[5%] xl:px-[7%]"
        >
          {snapshot.messages.length === 0 ? (
            <p className="mx-auto mt-6 w-fit rounded-lg bg-[#ffeecd] px-4 py-2 text-center text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
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
      </div>

      {/* Contact info: a side panel on wide screens, like WhatsApp… */}
      {wide && panelOpen && (
        <aside
          aria-label="Contact info"
          className="flex w-[340px] shrink-0 flex-col border-l border-[#e9edef] bg-white 2xl:w-[380px]"
        >
          <div className="flex h-[60px] shrink-0 items-center gap-3 bg-[#f0f2f5] px-4">
            <button
              type="button"
              onClick={() => setPanelPreference(false)}
              aria-label="Close contact info"
              className="-ml-2 rounded-full p-2 text-[#54656f] outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#00a884]"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <h2 className="text-[16px] text-[#111b21]">Contact info</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ContextPanel {...panel} />
          </div>
        </aside>
      )}

      {/* …and a drawer below that. */}
      <Drawer
        open={!wide && detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Contact info"
        description={contactName}
        width="sm"
      >
        <ContextPanel {...panel} unpadded />
      </Drawer>
    </div>
  );
}

const WIDE_QUERY = "(min-width: 1280px)";

/** xl and up: contact info docks beside the chat instead of in a drawer. */
function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(WIDE_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false
  );
}

/*
 * Whether the docked contact-info panel is open. Remembered across chats
 * (the thread remounts per conversation) and visits, per browser. Closed
 * by default, as in WhatsApp, so the chat gets the width.
 */
const PANEL_KEY = "nudge.inbox.contactInfo";
const PANEL_EVENT = "nudge:inbox-panel";

function readPanelPreference(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) === "open";
  } catch {
    return false;
  }
}

function setPanelPreference(open: boolean) {
  try {
    window.localStorage.setItem(PANEL_KEY, open ? "open" : "closed");
  } catch {
    // Storage blocked: the toggle still works for this page view below.
  }
  panelFallback = open;
  window.dispatchEvent(new Event(PANEL_EVENT));
}

let panelFallback: boolean | null = null;

function usePanelPreference(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(PANEL_EVENT, onChange);
      return () => window.removeEventListener(PANEL_EVENT, onChange);
    },
    () => panelFallback ?? readPanelPreference(),
    () => false
  );
}

/** Consecutive messages from one side share a group; only the first has a tail. */
function MessageList({
  messages,
}: {
  messages: ThreadSnapshot["messages"];
}) {
  return (
    <div className="flex w-full flex-col">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || dayKey(m.createdAt) !== dayKey(prev.createdAt);
        const firstOfGroup = newDay || prev.direction !== m.direction;
        const inbound = m.direction === "inbound";
        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="my-3 flex justify-center">
                <span
                  className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
                  suppressHydrationWarning
                >
                  {formatDayLabel(m.createdAt)}
                </span>
              </div>
            )}
            <div
              className={cn(
                "relative max-w-[85%] rounded-[7.5px] pb-2 pl-[9px] pr-[7px] pt-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:max-w-[65%]",
                inbound ? "self-start bg-white" : "self-end bg-[#d9fdd3]",
                firstOfGroup ? "mt-3" : "mt-0.5",
                firstOfGroup && (inbound ? "rounded-tl-none" : "rounded-tr-none")
              )}
            >
              {firstOfGroup && <BubbleTail inbound={inbound} />}
              <p className="whitespace-pre-wrap break-words">
                {whatsAppSegments(m.body).map((seg, i) =>
                  seg.bold ? (
                    <strong key={i}>{seg.text}</strong>
                  ) : seg.italic ? (
                    <em key={i}>{seg.text}</em>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  )
                )}
                {/* Reserves room so the time sits on the last line, as in WhatsApp. */}
                <span
                  aria-hidden
                  className={cn("inline-block h-3", inbound ? "w-[60px]" : "w-[78px]")}
                />
              </p>
              <span className="absolute bottom-[3px] right-[7px] flex items-center gap-[3px] text-[11px] leading-[15px] text-[#667781]">
                <span suppressHydrationWarning>
                  {formatMessageTime(m.createdAt)}
                </span>
                {!inbound && m.metaMessageId && (
                  <Check className="h-4 w-4" strokeWidth={2} aria-label="Sent" />
                )}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** WhatsApp's speech-bubble tail, in the bubble's own colour. */
function BubbleTail({ inbound }: { inbound: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 13"
      width="8"
      height="13"
      className={cn(
        "absolute top-0",
        inbound ? "-left-2 text-white" : "-right-2 text-[#d9fdd3]"
      )}
    >
      <path
        fill="currentColor"
        d={
          inbound
            ? "M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z"
            : "M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z"
        }
      />
    </svg>
  );
}
