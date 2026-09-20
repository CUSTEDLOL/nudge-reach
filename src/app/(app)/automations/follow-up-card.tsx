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
  /** Meta status of every template this follow-up sends. */
  templateStatuses: string[];
}

/**
 * The chip has to agree with the switch beside it. A rejection is surfaced
 * whatever the switch says — it is the owner's to fix — but an off follow-up
 * reads "Off" rather than "Waiting for Meta", which would imply it is armed.
 */
function statusOf(m: FollowUpCardModel): { label: string; tone: BadgeTone } {
  if (m.templateStatuses.includes("REJECTED")) {
    return { label: "Rejected by Meta", tone: "danger" };
  }
  if (!m.enabled) return { label: "Off", tone: "neutral" };
  if (m.templateStatuses.some((s) => s !== "APPROVED")) {
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
  const [draft, setDraft] = useState<FollowUpSpec | null>(model.spec);
  const status = statusOf(model);

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
