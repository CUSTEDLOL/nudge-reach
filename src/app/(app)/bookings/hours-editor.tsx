"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DAY_KEYS,
  DAY_LABELS,
  emptyHours,
  type DayKey,
  type HoursWindow,
  type OpeningHours,
} from "@/modules/calendar/hours";

/**
 * Seven rows, one per day: a closed/open switch and one or more open–close
 * windows. Serialised into a hidden input the Bookings form posts as JSON.
 * Deliberately plain: owners fill this once, in under a minute.
 */
export function HoursEditor({
  initial,
  disabled,
}: {
  initial: OpeningHours | null;
  disabled?: boolean;
}) {
  const [hours, setHours] = useState<OpeningHours>(initial ?? emptyHours());
  const [enabled, setEnabled] = useState(initial !== null);

  const update = (day: DayKey, windows: HoursWindow[]) =>
    setHours((h) => ({ ...h, [day]: windows }));

  return (
    <div className="rounded-xl border border-neutral-200">
      <input type="hidden" name="openingHours" value={enabled ? JSON.stringify(hours) : ""} />
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 bg-neutral-50 p-4">
        <div>
          <p className="text-sm font-medium text-neutral-900">
            {enabled ? "The AI only books during these hours" : "No opening hours set"}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {enabled
              ? "A request outside them is refused politely and the AI offers the next open time."
              : "Without hours, any free calendar slot can be booked — even 3 am on a Sunday."}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={disabled}
          aria-label="Restrict bookings to opening hours"
        />
      </div>
      {enabled && (
        <ul className="divide-y divide-neutral-100">
          {DAY_KEYS.map((day) => {
            const windows = hours[day];
            const open = windows.length > 0;
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-24 shrink-0 text-sm font-medium text-neutral-900">
                  {DAY_LABELS[day]}
                </span>
                <Switch
                  checked={open}
                  disabled={disabled}
                  onCheckedChange={(next) => update(day, next ? [["10:00", "20:00"]] : [])}
                  aria-label={`${DAY_LABELS[day]} open`}
                />
                {!open ? (
                  <span className="text-sm text-neutral-500">Closed</span>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {windows.map((w, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        <TimeInput
                          value={w[0]}
                          disabled={disabled}
                          label={`${DAY_LABELS[day]} opens`}
                          onChange={(v) => update(day, windows.map((x, j) => (j === i ? [v, x[1]] : x)))}
                        />
                        <span className="text-xs text-neutral-400">to</span>
                        <TimeInput
                          value={w[1]}
                          disabled={disabled}
                          label={`${DAY_LABELS[day]} closes`}
                          onChange={(v) => update(day, windows.map((x, j) => (j === i ? [x[0], v] : x)))}
                        />
                        {windows.length > 1 && (
                          <button
                            type="button"
                            disabled={disabled}
                            aria-label="Remove this window"
                            onClick={() => update(day, windows.filter((_, j) => j !== i))}
                            className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </span>
                    ))}
                    {windows.length < 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => update(day, [...windows, ["16:00", "20:00"]])}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Break
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-800 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
    />
  );
}
