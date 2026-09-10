"use client";

import { useState } from "react";
import { Mail, MessageCircle, NotebookPen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionForm } from "@/components/features/admin-shell/action-form";
import { LEAD_STATUSES, type LeadRow } from "@/modules/admin/leads";
import { updateLeadAction } from "./actions";

const TONE = { new: "brand", contacted: "info", converted: "success", dismissed: "neutral" } as const;

/** One lead: who, how to reach them, where they are in the pipeline, notes. */
export function LeadRowItem({ lead }: { lead: LeadRow }) {
  const [notesOpen, setNotesOpen] = useState(Boolean(lead.notes));
  const wa = `https://wa.me/${lead.phoneE164.replace(/[^\d]/g, "")}`;
  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="truncate">{lead.name}</span>
            <Badge tone={lead.kind === "access" ? "info" : "neutral"}>
              {lead.kind === "access" ? "access request" : "waitlist"}
            </Badge>
            {lead.vertical && <Badge tone="neutral">{lead.vertical}</Badge>}
            {lead.duplicateCount > 0 && (
              <Badge
                tone="neutral"
                title={`Matches ${lead.duplicateCount} other submission${lead.duplicateCount === 1 ? "" : "s"} by ${lead.duplicateBy.join(" and ")}`}
              >
                Duplicate details · {lead.duplicateCount + 1}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {lead.kind === "waitlist" && `${lead.secondary} · `}via {lead.source} ·{" "}
            {lead.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
            {lead.kind === "access" && (
              <a href={`mailto:${lead.secondary}`} rel="noreferrer" className="inline-flex items-center gap-1 text-neutral-700 hover:underline">
                <Mail className="h-3.5 w-3.5" aria-hidden /> Email {lead.secondary}
              </a>
            )}
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp {lead.phoneE164}
            </a>
          </div>
        </div>
        <Badge tone={TONE[lead.status]}>{lead.status}</Badge>
        <ActionForm
          action={updateLeadAction}
          hidden={{ kind: lead.kind, id: lead.id }}
          submitLabel="Update"
          className="flex items-center gap-2"
        >
          <select
            name="status"
            defaultValue={lead.status}
            aria-label="Lead status"
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2.5 text-sm outline-none focus:border-neutral-500"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </ActionForm>
        <button
          type="button"
          onClick={() => setNotesOpen((v) => !v)}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 sm:h-9"
        >
          <NotebookPen className="h-3.5 w-3.5" aria-hidden />
          {notesOpen ? "Hide notes" : lead.notes ? "Notes" : "Add note"}
        </button>
      </div>
      {notesOpen && (
        <ActionForm
          action={updateLeadAction}
          hidden={{ kind: lead.kind, id: lead.id }}
          submitLabel="Save note"
          variant="ghost"
          className="mt-2 flex items-start gap-2"
        >
          <textarea
            name="notes"
            defaultValue={lead.notes ?? ""}
            rows={2}
            placeholder="Call outcome, what they run, next step…"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </ActionForm>
      )}
    </li>
  );
}
