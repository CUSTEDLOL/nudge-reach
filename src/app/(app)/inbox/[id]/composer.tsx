"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Loader2, Lock, Send, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/dropdown";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { WhatsappPreview } from "@/components/features/whatsapp-preview";
import type { LibraryTemplate } from "@/modules/whatsapp/library";
import { SUGGEST_TONES, type SuggestTone } from "@/modules/ai/tones";
import {
  sendTemplateAction,
  sendTextAction,
  suggestReplyAction,
} from "../actions";

/**
 * Composer: free-form replies inside the 24h window (with AI-suggested
 * drafts — always editable, never auto-sent); outside it, an approved
 * template picker with preview. Consent failures surface as friendly toasts.
 */
export function Composer({
  conversationId,
  windowOpen,
  contactFirstName,
  contactName,
  templates,
  onSent,
}: {
  conversationId: string;
  windowOpen: boolean;
  contactFirstName: string;
  contactName: string;
  templates: LibraryTemplate[];
  onSent: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  async function handleSendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("text", body);
      const result = await sendTextAction(fd);
      if (result.ok) {
        setText("");
        requestAnimationFrame(() => fitHeight(inputRef.current));
        await onSent();
      } else {
        toast({ tone: "error", description: result.message });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSuggest(tone: SuggestTone) {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("tone", tone);
      const result = await suggestReplyAction(fd);
      if (result.ok && result.draft) {
        setText(result.draft);
        requestAnimationFrame(() => {
          fitHeight(inputRef.current);
          inputRef.current?.focus();
        });
        if (result.sample) {
          toast({ tone: "info", description: result.message });
        }
      } else {
        toast({ tone: "error", description: result.message });
      }
    } finally {
      setSuggesting(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendText();
    }
  }

  if (!windowOpen) {
    return (
      <TemplateSender
        conversationId={conversationId}
        contactFirstName={contactFirstName}
        contactName={contactName}
        templates={templates}
        onSent={onSent}
      />
    );
  }

  return (
    <div className="flex shrink-0 items-end gap-2 bg-[#f0f2f5] px-3 py-[9px] sm:px-4">
      {/* Where WhatsApp has its attach button: draft a reply with AI, in a
          chosen tone. The draft lands in the box — never auto-sent. */}
      <Menu
        align="start"
        triggerLabel="Draft a reply with AI"
        triggerClassName="shrink-0 text-[#54656f]"
        className="bottom-full mb-2"
        trigger={
          <span className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5">
            {suggesting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-5 w-5" aria-hidden />
            )}
          </span>
        }
      >
        <MenuLabel>Draft a reply with AI</MenuLabel>
        {SUGGEST_TONES.map((t) => (
          <MenuItem
            key={t.value}
            disabled={suggesting}
            onSelect={() => void handleSuggest(t.value)}
          >
            {t.label}
          </MenuItem>
        ))}
      </Menu>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          fitHeight(e.target);
        }}
        onKeyDown={onKeyDown}
        placeholder="Type a message"
        aria-label={`Reply to ${contactFirstName}`}
        title="Enter to send, Shift+Enter for a new line"
        rows={1}
        disabled={sending}
        className="max-h-[140px] min-h-[42px] flex-1 resize-none rounded-lg bg-white px-3 py-[10px] text-[15px] leading-[22px] text-[#111b21] outline-none placeholder:text-[#667781] focus-visible:ring-2 focus-visible:ring-[#00a884]/40 disabled:opacity-70"
      />
      <button
        type="button"
        onClick={handleSendText}
        disabled={!text.trim() || sending}
        aria-label="Send"
        className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-[#00a884] text-white outline-none transition-colors hover:bg-[#008f72] focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2 disabled:bg-[#54656f]/30"
      >
        {sending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <SendHorizontal className="h-5 w-5" aria-hidden />
        )}
      </button>
    </div>
  );
}

/** Grow the reply box with its text, up to its max height. */
function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function TemplateSender({
  conversationId,
  contactFirstName,
  contactName,
  templates,
  onSent,
}: {
  conversationId: string;
  contactFirstName: string;
  contactName: string;
  templates: LibraryTemplate[];
  onSent: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const selected = templates.find((t) => t.id === templateId) ?? null;

  async function handleSendTemplate() {
    if (!selected || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("templateId", selected.id);
      const result = await sendTemplateAction(fd);
      if (result.ok) {
        setPreviewOpen(false);
        toast({ tone: "success", description: result.message });
        await onSent();
      } else {
        toast({ tone: "error", description: result.message });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="shrink-0 bg-[#f0f2f5] px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        The 24-hour service window has closed — WhatsApp only allows an
        approved template until {contactFirstName} replies again.
      </p>
      {templates.length === 0 ? (
        <p className="mt-2 text-xs text-neutral-600">
          No approved templates yet.{" "}
          <Link
            href="/templates"
            className="font-medium text-brand-700 underline"
          >
            Create one in the template library
          </Link>
          .
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            aria-label="Choose a template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full sm:max-w-xs"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.category.toLowerCase()} · {t.language}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={() => setPreviewOpen(true)}
            disabled={!selected}
          >
            Preview & send
          </Button>
        </div>
      )}

      <Modal
        open={previewOpen && selected !== null}
        onClose={() => setPreviewOpen(false)}
        title={`Send “${selected?.name ?? ""}”`}
        description={`{{1}} is filled with the contact's first name — ${contactName} sees this:`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPreviewOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button onClick={handleSendTemplate} loading={sending}>
              {!sending && <Send className="h-3.5 w-3.5" aria-hidden />}
              Send template
            </Button>
          </>
        }
      >
        {selected?.content ? (
          <div className="max-h-[50vh] overflow-y-auto">
            <WhatsappPreview
              content={{ ...selected.content, sampleName: contactFirstName }}
            />
          </div>
        ) : (
          <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
            This template was approved by Meta as{" "}
            <span className="font-mono">{selected?.name}</span> (
            {selected?.language}). Its first variable is filled with{" "}
            <span className="font-medium">{contactFirstName}</span>.
          </p>
        )}
      </Modal>
    </div>
  );
}
