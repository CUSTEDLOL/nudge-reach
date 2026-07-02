"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Lock, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { WhatsappPreview } from "@/components/whatsapp-preview";
import type { LibraryTemplate } from "@/lib/whatsapp/library";
import { SUGGEST_TONES, type SuggestTone } from "@/lib/ai/tones";
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
  const [tone, setTone] = useState<SuggestTone>("friendly");
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
        await onSent();
      } else {
        toast({ tone: "error", description: result.message });
      }
    } finally {
      setSending(false);
    }
  }

  async function handleSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("tone", tone);
      const result = await suggestReplyAction(fd);
      if (result.ok && result.draft) {
        setText(result.draft);
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
    <div className="border-t border-neutral-100 p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Reply to ${contactFirstName}… (Enter to send, Shift+Enter for a new line)`}
        aria-label="Reply"
        rows={2}
        className="min-h-14 resize-none"
        disabled={sending}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSuggest}
          loading={suggesting}
          title="Draft a reply with AI — you edit and send it"
        >
          {!suggesting && (
            <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden />
          )}
          Suggest reply
        </Button>
        <div
          role="radiogroup"
          aria-label="Draft tone"
          className="flex flex-wrap items-center gap-1"
        >
          {SUGGEST_TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={tone === t.value}
              onClick={() => setTone(t.value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-400/50",
                tone === t.value
                  ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button
          className="ml-auto"
          size="sm"
          onClick={handleSendText}
          loading={sending}
          disabled={!text.trim()}
        >
          {!sending && <Send className="h-3.5 w-3.5" aria-hidden />}
          Send
        </Button>
      </div>
    </div>
  );
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
    <div className="border-t border-neutral-100 bg-amber-50/50 p-3">
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
