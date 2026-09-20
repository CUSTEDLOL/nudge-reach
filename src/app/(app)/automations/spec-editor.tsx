"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  describeMessageTiming,
  describeSituation,
  MAX_GAP_DAYS,
  type FollowUpSpec,
} from "@/modules/followup/spec";

/**
 * Edits the parts an owner cares about: name, days, wording. The situation is
 * shown, not edited — to change what starts a follow-up, describe a new one.
 * Shared by the bar's draft preview and a card's inline edit.
 */
export function SpecEditor({
  spec,
  onChange,
  disabled,
}: {
  spec: FollowUpSpec;
  onChange: (next: FollowUpSpec) => void;
  disabled?: boolean;
}) {
  const setMessage = (
    i: number,
    patch: Partial<FollowUpSpec["messages"][number]>
  ) =>
    onChange({
      ...spec,
      messages: spec.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    });

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-neutral-600">Name</span>
        <Input
          value={spec.name}
          disabled={disabled}
          maxLength={80}
          onChange={(e) => onChange({ ...spec, name: e.target.value })}
          className="mt-1"
        />
      </label>
      <p className="text-sm text-neutral-700">
        {describeSituation(spec.situation)}
      </p>
      {spec.messages.map((m, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{describeMessageTiming(i, m.afterDays)}</Badge>
            <Badge tone={m.category === "MARKETING" ? "brand" : "info"}>
              {m.category.toLowerCase()}
            </Badge>
            {/* A quiet chase's first message goes the moment the trigger fires
                — its wait already lives on the situation, so there is nothing
                to set here. */}
            {(i > 0 || spec.situation.kind !== "went_quiet") && (
              <label className="ml-auto flex items-center gap-1.5 text-xs text-neutral-600">
                after
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_GAP_DAYS}
                  value={m.afterDays}
                  disabled={disabled}
                  onChange={(e) =>
                    setMessage(i, {
                      afterDays: Math.max(
                        0,
                        Math.min(MAX_GAP_DAYS, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-16"
                />
                days
              </label>
            )}
          </div>
          <Input
            value={m.header}
            disabled={disabled}
            maxLength={60}
            onChange={(e) => setMessage(i, { header: e.target.value })}
            className="mt-2"
            aria-label="Headline"
          />
          <Textarea
            value={m.body}
            disabled={disabled}
            maxLength={600}
            onChange={(e) => setMessage(i, { body: e.target.value })}
            className="mt-2"
            aria-label="Message"
          />
          <p className="mt-1 text-xs text-neutral-500">
            {"{{1}}"} becomes the customer&rsquo;s first name.
            {m.category === "MARKETING" &&
              " Marketing messages carry the STOP footer."}
          </p>
        </div>
      ))}
    </div>
  );
}
