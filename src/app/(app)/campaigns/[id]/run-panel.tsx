"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  runCampaignAction,
  scheduleCampaignAction,
  type ActionResult,
} from "../actions";

export interface AudienceOption {
  id: string;
  name: string;
  optedInCount: number;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RunPanel({
  campaignId,
  audiences,
  defaultAudienceId,
  ratePaise,
  currencySymbol = "₹",
  simulation,
}: {
  campaignId: string;
  audiences: AudienceOption[];
  defaultAudienceId?: string | null;
  ratePaise: number;
  currencySymbol?: string;
  simulation: boolean;
}) {
  const [audienceId, setAudienceId] = useState(
    (defaultAudienceId &&
      audiences.some((a) => a.id === defaultAudienceId) &&
      defaultAudienceId) ||
      audiences[0]?.id ||
      ""
  );
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [minLocal, setMinLocal] = useState("");

  // Computed in the event handler (not during render — hooks purity).
  function chooseLater() {
    setWhen("later");
    setMinLocal(toLocalInputValue(new Date()));
    setScheduledAtLocal(
      (prev) => prev || toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))
    );
  }

  const [runResult, run, running] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      runCampaignAction(formData),
    null
  );
  const [scheduleResult, schedule, scheduling] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const local = String(formData.get("scheduledAtLocal") ?? "");
      const parsed = new Date(local);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, message: "Pick a valid date and time." };
      }
      formData.set("scheduledAtIso", parsed.toISOString());
      return scheduleCampaignAction(formData);
    },
    null
  );

  const selected = audiences.find((a) => a.id === audienceId);
  const estimate = selected ? selected.optedInCount * ratePaise : 0;
  const pending = running || scheduling;
  const result = when === "later" ? scheduleResult : runResult;

  if (audiences.length === 0) {
    return (
      <Card className="p-4 text-sm text-neutral-600">
        You need an audience first —{" "}
        <Link href="/contacts" className="font-medium text-brand-700 hover:underline">
          create one from your customers
        </Link>
        .
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <form action={when === "later" ? schedule : run}>
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Send to" htmlFor="run-audience" className="min-w-56">
            <Select
              id="run-audience"
              name="audienceId"
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
            >
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.optedInCount} opted in)
                </option>
              ))}
            </Select>
          </Field>

          <div className="text-sm text-neutral-600">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Estimated cost
            </p>
            <p className="mt-1">
              {selected?.optedInCount ?? 0} × {currencySymbol}{(ratePaise / 100).toFixed(2)} ={" "}
              <span className="font-semibold text-neutral-900">
                {currencySymbol}{(estimate / 100).toFixed(2)}
              </span>{" "}
              <span className="text-xs text-neutral-400">(estimate)</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 border-t border-neutral-100 pt-4">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="whenChoice"
                checked={when === "now"}
                onChange={() => setWhen("now")}
                className="h-4 w-4 accent-brand-600"
              />
              Send now
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="radio"
                name="whenChoice"
                checked={when === "later"}
                onChange={chooseLater}
                className="h-4 w-4 accent-brand-600"
              />
              Schedule for later
            </label>
            {when === "later" && (
              <Input
                type="datetime-local"
                name="scheduledAtLocal"
                value={scheduledAtLocal}
                min={minLocal || undefined}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                required
                aria-label="Scheduled date and time"
                className="w-auto"
              />
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="consentConfirmed"
              required
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-brand-600"
            />
            <span>
              These contacts <strong>opted in</strong> to WhatsApp marketing
              from my business. (Meta policy — opt-outs are honored
              permanently.)
            </span>
          </label>

          <Button
            type="submit"
            loading={pending}
            className={cn("mt-1 self-start")}
          >
            <Rocket className="h-4 w-4" aria-hidden />
            {when === "later"
              ? "Schedule broadcast"
              : simulation
                ? "Run campaign (test mode)"
                : "Run campaign"}
          </Button>
        </div>

        {simulation && (
          <p className="mt-3 text-xs text-neutral-400">
            Test mode: no real messages leave the building — delivery is
            mocked so you can see the full journey.
          </p>
        )}
        {result && !result.ok && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {result.message}
          </p>
        )}
      </form>
    </Card>
  );
}
