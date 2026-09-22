"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Pencil, Trash2, Workflow } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  describeMessageTiming,
  describeSituation,
  type FollowUpSpec,
} from "@/modules/followup/spec";
import { toggleAutomation } from "./actions";
import { deleteFollowUpAction, updateFollowUpAction } from "./followup-actions";
import { SpecEditor } from "./spec-editor";

export interface CardTemplate {
  id: string;
  name: string;
  status: string;
}

export interface FollowUpCardModel {
  id: string;
  name: string;
  /** Null for a hand-built follow-up — the builder clears the spec when it
   *  saves, so there is no plain-English version to show or edit here. */
  spec: FollowUpSpec | null;
  source: string;
  enabled: boolean;
  triggerLabel: string;
  stepsCount: number;
  /** Every template this follow-up sends, so the card can both colour its chip
   *  and link the ones Meta has not approved. */
  templates: CardTemplate[];
}

/**
 * The chip has to agree with the switch beside it. A rejection is surfaced
 * whatever the switch says — it is the owner's to fix — but an off follow-up
 * reads "Off" rather than "Waiting for Meta", which would imply it is armed.
 * (Every freshly created follow-up lands off with pending templates, so the
 * naive order labelled the whole starter set "Waiting for Meta".)
 */
export function statusOf(m: {
  enabled: boolean;
  templates: Array<{ status: string }>;
}): { label: string; tone: BadgeTone } {
  if (m.templates.some((t) => t.status === "REJECTED")) {
    return { label: "Rejected by Meta", tone: "danger" };
  }
  if (!m.enabled) return { label: "Off", tone: "neutral" };
  if (m.templates.some((t) => t.status !== "APPROVED")) {
    return { label: "Waiting for Meta", tone: "warning" };
  }
  return { label: "On", tone: "success" };
}

export function FollowUpCard({
  model,
  canManage,
}: {
  model: FollowUpCardModel;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  // Derived from a prop on purpose, and safe: the list is keyed by automation
  // id, so a different follow-up is a different component instance, and a
  // successful save writes the server's spec back into this state. A stale
  // draft can only survive a Cancel, which re-reads the prop.
  const [draft, setDraft] = useState<FollowUpSpec | null>(model.spec);
  const status = statusOf(model);
  // Only the unapproved ones: an approved template needs no attention here.
  const needsAttention = model.templates.filter(
    (t) => t.id && t.status !== "APPROVED"
  );

  function toggle(next: boolean) {
    start(async () => {
      const fd = new FormData();
      fd.set("automationId", model.id);
      fd.set("enabled", String(next));
      const r = await toggleAutomation(fd);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await updateFollowUpAction(model.id, draft);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      // Show what was stored, not what was submitted: the server repairs the
      // {{1}}, the STOP footer and a quiet chase's first message.
      if (r.ok && r.spec) {
        setDraft(r.spec);
        setEditing(false);
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete "${model.name}"? Its templates stay in your library.`
      )
    ) {
      return;
    }
    start(async () => {
      const r = await deleteFollowUpAction(model.id);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900">
              {model.name}
            </h3>
            <Badge tone={status.tone}>{status.label}</Badge>
            {model.source === "pack" && <Badge tone="brand">Included</Badge>}
          </div>
          <p className="mt-1 text-sm text-neutral-700">
            {model.spec
              ? describeSituation(model.spec.situation)
              : `When: ${model.triggerLabel}`}
          </p>

          {/* The days on a booked follow-up run from the booking, not from the
              appointment — an owner reading "1 day later" as "the day after the
              visit" would send "How did it go?" before they had been. */}
          {model.spec?.situation.kind === "booked" && (
            <p className="mt-1 text-xs text-neutral-500">
              Timed from when they book, not from the appointment date. For
              reminders before an appointment, use Appointment reminders above.
            </p>
          )}

          {model.spec && !editing && (
            <ol className="mt-2 space-y-1.5">
              {model.spec.messages.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-xs text-neutral-500">
                    {describeMessageTiming(i, m.afterDays)}
                  </span>
                  <span className="min-w-0 truncate text-neutral-600">
                    {m.body}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {/* Hand-built: no spec to read back, so say what it is and send the
              owner to the editor that owns it. */}
          {!model.spec && (
            <p className="mt-1 text-xs text-neutral-500">
              {model.stepsCount} step{model.stepsCount === 1 ? "" : "s"}
              {" · built in the editor"}
            </p>
          )}

          {/* A rejected or pending chip is otherwise a dead end: link the
              template whose wording has to change, as the rows above do. */}
          {needsAttention.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {needsAttention.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1.5">
                  <Link
                    href={`/templates/${t.id}?from=followups`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50"
                  >
                    <Pencil className="h-3 w-3" aria-hidden />
                    {t.name}
                  </Link>
                  <Badge tone={t.status === "REJECTED" ? "danger" : "warning"}>
                    {t.status.toLowerCase()}
                  </Badge>
                </span>
              ))}
            </div>
          )}

          {editing && draft && (
            <div className="mt-3">
              <SpecEditor spec={draft} onChange={setDraft} disabled={pending} />
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={save} loading={pending}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(model.spec);
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {canManage && !editing && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {model.spec && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:opacity-60"
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </button>
              )}
              <Link
                href={`/automations/${model.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50"
              >
                <Workflow className="h-3 w-3" aria-hidden /> Open in builder
              </Link>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 outline-none transition-colors duration-150 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" aria-hidden /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="text-xs text-neutral-500">
            {model.enabled ? "On" : "Off"}
          </span>
          <Switch
            checked={model.enabled}
            onCheckedChange={toggle}
            disabled={!canManage || pending}
            aria-label={`${model.enabled ? "Pause" : "Enable"} ${model.name}`}
          />
        </div>
      </div>
    </Card>
  );
}
