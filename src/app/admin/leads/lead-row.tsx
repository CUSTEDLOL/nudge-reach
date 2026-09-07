"use client";

import { useState } from "react";
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
          </p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {lead.secondary} ·{" "}
            <a href={wa} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
              {lead.phoneE164}
            </a>{" "}
            · via {lead.source} ·{" "}
            {lead.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
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
          className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
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
