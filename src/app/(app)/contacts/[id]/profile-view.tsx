"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  FlaskConical,
  Mail,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  Send,
  StickyNote,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { TagPill } from "@/components/ui/tag-pill";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { canSendMarketing } from "@/modules/consent";
import { cn } from "@/lib/cn";
import {
  addContactNote,
  addContactTag,
  deleteContact,
  optOutContact,
  removeContactTag,
  simulateContactMessage,
  updateContact,
  type ActionResult,
} from "../actions";
import {
  formatDate,
  formatDateTime,
  formatPaise,
  MESSAGE_STATUS_TONE,
  sourceLabel,
  STAGE_LABEL,
  STAGE_TONE,
  STAGES,
  type ActivityItem,
  type CampaignMessageRow,
  type ContactRow,
  type MemberOption,
  type NoteRow,
  type TagInfo,
} from "../types";

// ---------------------------------------------------------------------------
// Inline-editable field (name / phone / email)
// ---------------------------------------------------------------------------

function InlineEdit({
  contactId,
  field,
  value,
  displayClass,
  inputType = "text",
  placeholder,
  ariaLabel,
}: {
  contactId: string;
  field: "name" | "phone" | "email";
  value: string;
  displayClass?: string;
  inputType?: string;
  placeholder: string;
  ariaLabel: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("contactId", contactId);
    fd.set(field, draft);
    startTransition(async () => {
      const res = await updateContact(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok) setEditing(false);
    });
  }

  if (!editing) {
    return (
      <span className="group/inline inline-flex min-w-0 items-center gap-1">
        <span className={cn("truncate", displayClass)}>
          {value || <span className="text-neutral-300">{placeholder}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          aria-label={`Edit ${ariaLabel}`}
          className="rounded p-1 text-neutral-300 opacity-0 outline-none transition-all duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-400/50 group-hover/inline:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        value={draft}
        type={inputType}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoFocus
        className="h-8 w-56 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button size="sm" onClick={save} loading={pending} aria-label={`Save ${ariaLabel}`}>
        <Check className="h-3.5 w-3.5" aria-hidden />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        aria-label={`Cancel editing ${ariaLabel}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function ProfileView({
  contact,
  tags,
  members,
  notes,
  activity,
  campaignMessages,
  conversationId,
  simulation,
}: {
  contact: ContactRow;
  tags: TagInfo[];
  members: MemberOption[];
  notes: NoteRow[];
  activity: ActivityItem[];
  campaignMessages: CampaignMessageRow[];
  /** Existing conversation for this contact, if any. */
  conversationId: string | null;
  /** SEND_MODE=simulation — enables the "message as customer" tester. */
  simulation: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmOptOut, setConfirmOptOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [tab, setTab] = useState("activity");

  const optedIn = canSendMarketing({
    optedIn: contact.optedIn,
    optedOutAt: contact.optedOutAt ? new Date(contact.optedOutAt) : null,
  });

  function runUpdate(fields: Record<string, string>) {
    const fd = new FormData();
    fd.set("contactId", contact.id);
    for (const [key, value] of Object.entries(fields)) fd.set(key, value);
    startTransition(async () => {
      const res = await updateContact(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
    });
  }

  function runTag(
    action: (fd: FormData) => Promise<ActionResult>,
    tagId: string
  ) {
    const fd = new FormData();
    fd.set("contactId", contact.id);
    fd.set("tagId", tagId);
    startTransition(async () => {
      const res = await action(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
    });
  }

  const availableTags = tags.filter(
    (t) => !contact.tags.some((ct) => ct.id === t.id)
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header card */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={contact.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <InlineEdit
                contactId={contact.id}
                field="name"
                value={contact.name}
                displayClass="text-lg font-semibold text-neutral-900"
                placeholder="Name"
                ariaLabel="name"
              />
              {optedIn ? (
                <Badge tone="success">Opted in</Badge>
              ) : contact.optedOutAt ? (
                <Badge tone="danger">
                  Opted out {formatDate(contact.optedOutAt)}
                </Badge>
              ) : (
                <Badge tone="neutral">No consent</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                <InlineEdit
                  contactId={contact.id}
                  field="phone"
                  value={contact.phoneE164}
                  displayClass="font-mono text-xs text-neutral-600"
                  placeholder="Phone"
                  ariaLabel="phone"
                />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                <InlineEdit
                  contactId={contact.id}
                  field="email"
                  value={contact.email ?? ""}
                  inputType="email"
                  placeholder="Add email"
                  ariaLabel="email"
                />
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Added {formatDate(contact.createdAt)} · Source{" "}
              {sourceLabel(contact.optInSource)} · Last contacted{" "}
              {formatDate(contact.lastContactedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {conversationId ? (
              <Link
                href={`/inbox/${conversationId}`}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                Open chat
              </Link>
            ) : simulation ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSimOpen(true)}
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                Message as customer
              </Button>
            ) : null}
            {optedIn && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmOptOut(true)}
                className="text-red-600 hover:bg-red-50"
              >
                Opt out
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <CardTitle>Details</CardTitle>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-stage">Stage</Label>
                <div className="flex items-center gap-2">
                  <Select
                    id="profile-stage"
                    value={contact.leadStage}
                    disabled={pending}
                    onChange={(e) => runUpdate({ leadStage: e.target.value })}
                  >
                    {STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Badge tone={STAGE_TONE[contact.leadStage]}>
                    {STAGE_LABEL[contact.leadStage]}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-assignee">Assignee</Label>
                <Select
                  id="profile-assignee"
                  value={contact.assignedToUserId ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    runUpdate({ assignedToUserId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-add-tag">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((t) => (
                    <TagPill
                      key={t.id}
                      label={t.name}
                      color={t.color}
                      onRemove={() => runTag(removeContactTag, t.id)}
                    />
                  ))}
                  {contact.tags.length === 0 && (
                    <span className="text-xs text-neutral-400">
                      No tags yet.
                    </span>
                  )}
                </div>
                {availableTags.length > 0 ? (
                  <Select
                    id="profile-add-tag"
                    value=""
                    disabled={pending}
                    onChange={(e) => {
                      if (e.target.value) runTag(addContactTag, e.target.value);
                    }}
                    className="mt-1"
                  >
                    <option value="">Add a tag…</option>
                    {availableTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  tags.length === 0 && (
                    <p className="text-xs text-neutral-400">
                      Create tags with “Manage tags” on the contacts page.
                    </p>
                  )
                )}
              </div>
            </div>
          </Card>

          <Card className="border-red-100 p-5">
            <CardTitle className="text-red-700">Danger zone</CardTitle>
            <CardDescription className="mt-1">
              Deleting removes this contact&apos;s conversations, notes and
              campaign history. It cannot be undone.
            </CardDescription>
            <Button
              variant="danger"
              size="sm"
              className="mt-4"
              onClick={() => setConfirmDelete(true)}
            >
              Delete contact
            </Button>
          </Card>
        </div>

        {/* Right column */}
        <Card className="lg:col-span-2">
          <div className="px-5 pt-5">
            <Tabs
              aria-label="Contact history"
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "activity", label: "Activity", count: activity.length },
                { value: "notes", label: "Notes", count: notes.length },
                {
                  value: "campaigns",
                  label: "Campaigns",
                  count: campaignMessages.length,
                },
              ]}
            />
          </div>
          <div className="p-5 pt-4">
            {tab === "activity" && <ActivityTimeline items={activity} />}
            {tab === "notes" && (
              <NotesPanel contactId={contact.id} notes={notes} />
            )}
            {tab === "campaigns" && (
              <CampaignsPanel rows={campaignMessages} />
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOptOut}
        onClose={() => setConfirmOptOut(false)}
        title={`Opt ${contact.name} out of campaigns?`}
        description="This is permanent. Opted-out contacts can never receive marketing messages again — the consent gate blocks every send path."
        confirmLabel="Opt out permanently"
        tone="danger"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("contactId", contact.id);
          const res = await optOutContact(fd);
          toast({ description: res.message, tone: res.ok ? "success" : "error" });
        }}
      />

      <SimMessageDialog
        open={simOpen}
        onClose={() => setSimOpen(false)}
        contactId={contact.id}
        contactName={contact.name}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${contact.name}?`}
        description="Their conversations, notes and campaign history are deleted too. This cannot be undone."
        confirmLabel="Delete contact"
        tone="danger"
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("contactId", contact.id);
          const res = await deleteContact(fd);
          toast({ description: res.message, tone: res.ok ? "success" : "error" });
          if (res.ok) router.push("/contacts");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulation: message as this customer (creates the first conversation)
// ---------------------------------------------------------------------------

function SimMessageDialog({
  open,
  onClose,
  contactId,
  contactName,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    const fd = new FormData();
    fd.set("contactId", contactId);
    fd.set("text", text);
    startTransition(async () => {
      const res = await simulateContactMessage(fd);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      if (res.ok && res.conversationId) {
        onClose();
        router.push(`/inbox/${res.conversationId}`);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Message as ${contactName}`}
      description="Simulation only — pretend this customer texted your WhatsApp. It runs through the exact same handler as a real inbound message and opens the conversation in your inbox."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={send} loading={pending} disabled={!text.trim()}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            Send as customer
          </Button>
        </div>
      }
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        placeholder={`e.g. "Hi! Are you open this weekend?"`}
        aria-label={`Message from ${contactName}`}
      />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tabs content
// ---------------------------------------------------------------------------

const ACTIVITY_ICON: Record<ActivityItem["kind"], typeof MessageCircle> = {
  message_in: MessageCircle,
  message_out: Send,
  campaign: Megaphone,
};

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        No activity yet — conversations and campaign sends will show up here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item) => {
        const Icon = ACTIVITY_ICON[item.kind];
        return (
          <li key={item.id} className="flex gap-3 py-2.5">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                item.kind === "message_in"
                  ? "bg-sky-50 text-sky-600"
                  : item.kind === "message_out"
                    ? "bg-brand-50 text-brand-600"
                    : "bg-amber-50 text-amber-600"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-800">
                {item.title}
                {item.status && (
                  <Badge tone={MESSAGE_STATUS_TONE[item.status] ?? "neutral"}>
                    {item.status.toLowerCase()}
                  </Badge>
                )}
              </p>
              {item.body && (
                <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">
                  {item.body}
                </p>
              )}
            </div>
            <span className="shrink-0 text-xs text-neutral-400">
              {formatDateTime(item.at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function NotesPanel({
  contactId,
  notes,
}: {
  contactId: string;
  notes: NoteRow[];
}) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, action, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      addContactNote(formData),
    null
  );

  useEffect(() => {
    if (result?.ok) {
      toast({ description: result.message, tone: "success" });
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div>
      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="contactId" value={contactId} />
        <Textarea
          name="body"
          required
          rows={2}
          placeholder="Internal note — never sent to the customer."
          aria-label="New note"
        />
        {result && !result.ok && (
          <p className="text-xs font-medium text-red-600" role="alert">
            {result.message}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={pending}>
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            Add note
          </Button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">
          No notes yet — jot down sizes, preferences, follow-ups.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {notes.map((n) => (
            <li key={n.id} className="py-3">
              <p className="text-sm text-neutral-700">{n.body}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {n.authorName} · {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignsPanel({ rows }: { rows: CampaignMessageRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        This contact hasn&apos;t received any campaigns yet.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-t-0 hover:bg-transparent">
          <TableHead>Campaign</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium text-neutral-800">
              {m.campaignName}
            </TableCell>
            <TableCell>
              <Badge tone={MESSAGE_STATUS_TONE[m.status] ?? "neutral"}>
                {m.status.toLowerCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-neutral-500">
              {formatDateTime(m.sentAt ?? m.createdAt)}
            </TableCell>
            <TableCell className="text-right text-xs text-neutral-500">
              {m.costMinorUnits != null ? formatPaise(m.costMinorUnits) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
