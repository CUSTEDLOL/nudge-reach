"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { TagPill } from "@/components/ui/tag-pill";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/modules/inbox/format";
import {
  addContactTagAction,
  addNoteAction,
  assignConversationAction,
  removeContactTagAction,
  setConversationStatusAction,
  setLeadStageAction,
  type ActionResult,
} from "../actions";

export interface ContextPanelProps {
  conversationId: string;
  status: string;
  assignedToUserId: string | null;
  lastInboundAt: string | null;
  contact: {
    id: string;
    name: string;
    phoneE164: string;
    email: string | null;
    optedIn: boolean;
    optedOut: boolean;
    leadStage: string;
    optInSource: string;
    createdAt: string;
  };
  contactTags: { id: string; name: string; color: string }[];
  orgTags: { id: string; name: string; color: string }[];
  members: { userId: string; name: string }[];
  notes: { id: string; authorName: string; body: string; createdAt: string }[];
  /** Set inside the Drawer, which brings its own padding. */
  unpadded?: boolean;
}

const LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
] as const;

/** Right pane: contact card + conversation controls + notes (spec §M2). */
export function ContextPanel({
  conversationId,
  status,
  assignedToUserId,
  contact,
  contactTags,
  orgTags,
  members,
  notes,
  unpadded = false,
}: ContextPanelProps) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [noteBody, setNoteBody] = useState("");

  function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData) {
    startTransition(async () => {
      const result = await action(fd);
      toast({
        tone: result.ok ? "success" : "error",
        description: result.message,
      });
    });
  }

  const fields = (entries: Record<string, string>) => {
    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("contactId", contact.id);
    for (const [k, v] of Object.entries(entries)) fd.set(k, v);
    return fd;
  };

  const availableTags = orgTags.filter(
    (t) => !contactTags.some((ct) => ct.id === t.id)
  );

  // "handoff" is an open-with-badge state; no button maps to it directly.
  const activeStatus =
    status === "handoff" ? "open" : status === "closed" ? "resolved" : status;

  return (
    <div className={cn("flex flex-col gap-5", !unpadded && "p-4")}>
      {/* Contact card */}
      <div>
        <div className="flex items-center gap-3">
          <Avatar name={contact.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {contact.name}
            </p>
            <p className="truncate font-mono text-xs text-neutral-400">
              {contact.phoneE164}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {contact.optedOut ? (
            <Badge tone="danger">Opted out</Badge>
          ) : contact.optedIn ? (
            <Badge tone="success">Opted in</Badge>
          ) : (
            <Badge tone="warning">No marketing opt-in</Badge>
          )}
          <Badge tone="neutral">via {contact.optInSource}</Badge>
        </div>
        <dl className="mt-3 space-y-1.5 text-xs">
          {contact.email && (
            <div className="flex justify-between gap-3">
              <dt className="shrink-0 text-neutral-400">Email</dt>
              <dd className="truncate text-neutral-700">{contact.email}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-400">Added</dt>
            <dd className="text-neutral-700" suppressHydrationWarning>
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(contact.createdAt))}
            </dd>
          </div>
        </dl>
        <Link
          href={`/contacts/${contact.id}`}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-400/50"
        >
          View full contact
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {/* Conversation status */}
      <section aria-label="Conversation status">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Status
        </h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              disabled={pending}
              aria-pressed={activeStatus === s.value}
              onClick={() =>
                run(
                  setConversationStatusAction,
                  fields({ status: s.value })
                )
              }
              className={cn(
                "h-8 rounded-lg border text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:opacity-60",
                activeStatus === s.value
                  ? "border-brand-200 bg-brand-50 text-brand-700"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {status === "handoff" && (
          <p className="mt-1.5 text-xs text-amber-700">
            The AI agent handed this off — reply, then mark it resolved.
          </p>
        )}
      </section>

      {/* Assignee */}
      <section>
        <Label
          htmlFor="cp-assignee"
          className="text-xs font-medium uppercase tracking-wide text-neutral-400"
        >
          Assignee
        </Label>
        <Select
          id="cp-assignee"
          className="mt-1.5"
          disabled={pending}
          value={assignedToUserId ?? ""}
          onChange={(e) =>
            run(assignConversationAction, fields({ userId: e.target.value }))
          }
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </Select>
      </section>

      {/* Lead stage */}
      <section>
        <Label
          htmlFor="cp-stage"
          className="text-xs font-medium uppercase tracking-wide text-neutral-400"
        >
          Lead stage
        </Label>
        <Select
          id="cp-stage"
          className="mt-1.5"
          disabled={pending}
          value={contact.leadStage}
          onChange={(e) =>
            run(setLeadStageAction, fields({ stage: e.target.value }))
          }
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </section>

      {/* Tags */}
      <section aria-label="Tags">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Tags
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {contactTags.map((t) => (
            <TagPill
              key={t.id}
              label={t.name}
              color={t.color}
              onRemove={() =>
                run(removeContactTagAction, fields({ tagId: t.id }))
              }
            />
          ))}
          {contactTags.length === 0 && (
            <span className="text-xs text-neutral-400">No tags yet</span>
          )}
        </div>
        {availableTags.length > 0 && (
          <div className="relative mt-2">
            <Plus
              className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <Select
              aria-label="Add a tag"
              disabled={pending}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  run(addContactTagAction, fields({ tagId: e.target.value }));
                }
              }}
              className="[&_select]:pl-8"
            >
              <option value="" disabled>
                Add tag…
              </option>
              {availableTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </section>

      {/* Notes */}
      <section aria-label="Internal notes">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Internal notes
        </h3>
        <form
          className="mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            const body = noteBody.trim();
            if (!body) return;
            startTransition(async () => {
              const result = await addNoteAction(fields({ body }));
              toast({
                tone: result.ok ? "success" : "error",
                description: result.message,
              });
              if (result.ok) setNoteBody("");
            });
          }}
        >
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Only your team sees notes…"
            aria-label="New note"
            rows={2}
            className="min-h-14"
            disabled={pending}
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            className="mt-1.5"
            disabled={!noteBody.trim()}
            loading={pending && noteBody.trim().length > 0}
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Add note
          </Button>
        </form>
        <ul className="mt-3 space-y-2.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-amber-100 bg-amber-50/60 p-2.5"
            >
              <p className="whitespace-pre-wrap break-words text-xs text-neutral-800">
                {n.body}
              </p>
              <p className="mt-1.5 text-[11px] text-neutral-400">
                {n.authorName} ·{" "}
                <span suppressHydrationWarning>
                  {formatRelativeTime(n.createdAt)}
                </span>
              </p>
            </li>
          ))}
          {notes.length === 0 && (
            <li className="text-xs text-neutral-400">
              No notes on this conversation yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
