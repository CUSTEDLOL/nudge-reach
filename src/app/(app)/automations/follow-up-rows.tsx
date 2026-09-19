"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Clock, Pencil, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  MAX_TIMING_HOURS,
  MIN_TIMING_HOURS,
  TIMING_DEFAULTS,
  type FollowUpTiming,
  type TimingField,
} from "@/modules/followup/pack";
import { setFollowUpFlagAction, setFollowUpTimingAction } from "./followup-actions";

export interface FollowUpRow {
  flag: string;
  label: string;
  timing: string;
  description: string;
  enabled: boolean;
  templates: Array<{ id: string; name: string; status: string }>;
  timingFields: Array<{ field: TimingField; label: string }>;
  /** Set when the steps live in the builder instead of the reminder tick. */
  builderHref?: string;
}

export function FollowUpRows({
  rows,
  timing,
  canManage,
  paused,
}: {
  rows: FollowUpRow[];
  timing: FollowUpTiming;
  canManage: boolean;
  paused: boolean;
}) {
  return (
    <Card className="divide-y divide-neutral-100">
      {rows.map((row) => (
        <Row
          key={row.flag}
          row={row}
          timing={timing}
          canManage={canManage}
          paused={paused}
        />
      ))}
    </Card>
  );
}

function Row({
  row,
  timing,
  canManage,
  paused,
}: {
  row: FollowUpRow;
  timing: FollowUpTiming;
  canManage: boolean;
  paused: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function onToggle(next: boolean) {
    start(async () => {
      const r = await setFollowUpFlagAction(row.flag, next);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{row.label}</h3>
          <Badge tone="neutral">
            <Clock className="h-3 w-3" aria-hidden />
            {row.timing}
          </Badge>
        </div>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">{row.description}</p>

        {row.timingFields.length > 0 && (
          <TimingForm
            fields={row.timingFields}
            timing={timing}
            canManage={canManage && !paused}
          />
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {row.templates.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5">
              <Link
                href={`/templates/${t.id}?from=followups`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                {t.name}
              </Link>
              {t.status !== "APPROVED" && (
                <Badge tone={t.status === "REJECTED" ? "danger" : "warning"}>
                  {t.status.toLowerCase()}
                </Badge>
              )}
            </span>
          ))}
          {row.builderHref && (
            <Link
              href={row.builderHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-150 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-400/50"
            >
              <Workflow className="h-3 w-3" aria-hidden />
              Edit the timing and steps
            </Link>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <span className="text-xs text-neutral-500">
          {row.enabled ? "On" : "Off"}
        </span>
        <Switch
          checked={row.enabled}
          onCheckedChange={onToggle}
          disabled={!canManage || pending || paused}
          aria-label={`${row.enabled ? "Pause" : "Enable"} ${row.label}`}
        />
      </div>
    </div>
  );
}

function TimingForm({
  fields,
  timing,
  canManage,
}: {
  fields: Array<{ field: TimingField; label: string }>;
  timing: FollowUpTiming;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.field, String(timing[f.field])]))
  );

  const dirty = fields.some((f) => draft[f.field] !== String(timing[f.field]));
  // The pack's wording is written around the default hours ("tomorrow", "in a
  // couple of hours"), so a changed schedule needs the copy changed to match.
  const offDefault = fields.some(
    (f) => Number(draft[f.field]) !== TIMING_DEFAULTS[f.field]
  );

  function save() {
    start(async () => {
      const r = await setFollowUpTimingAction({
        ...timing,
        ...Object.fromEntries(
          fields.map((f) => [f.field, Number(draft[f.field])])
        ),
      });
      if (r.ok && r.timing) {
        setDraft(
          Object.fromEntries(fields.map((f) => [f.field, String(r.timing![f.field])]))
        );
      }
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((f) => (
          <label key={f.field} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-600">
              {f.label}
            </span>
            <span className="flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_TIMING_HOURS}
                max={MAX_TIMING_HOURS}
                value={draft[f.field] ?? ""}
                disabled={!canManage || pending}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.field]: e.target.value }))
                }
                className="w-20"
              />
              <span className="text-xs text-neutral-500">hours</span>
            </span>
          </label>
        ))}
        {dirty && (
          <Button size="sm" onClick={save} loading={pending} disabled={!canManage}>
            Save
          </Button>
        )}
      </div>
      {offDefault && (
        <p className="mt-1.5 text-xs text-amber-700">
          The written message still says &ldquo;tomorrow&rdquo; — edit the
          template below so the wording matches the new timing.
        </p>
      )}
    </div>
  );
}
