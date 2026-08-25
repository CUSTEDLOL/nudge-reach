"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  cancelScheduleAction,
  sendScheduledNowAction,
  type ActionResult,
} from "../actions";

/** SCHEDULED campaigns: countdown card with send-now / cancel controls. */
export function SchedulePanel({
  campaignId,
  scheduledAt,
  audienceName,
  optedInCount,
  ratePaise,
  currencySymbol = "₹",
  simulation,
}: {
  campaignId: string;
  scheduledAt: string | null;
  audienceName: string;
  optedInCount: number;
  ratePaise: number;
  currencySymbol?: string;
  simulation: boolean;
}) {
  const { toast } = useToast();

  const [sendResult, sendNow, sending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const res = await sendScheduledNowAction(formData);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      return res;
    },
    null
  );
  const [cancelResult, cancel, cancelling] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const res = await cancelScheduleAction(formData);
      toast({ description: res.message, tone: res.ok ? "success" : "error" });
      return res;
    },
    null
  );

  const whenLabel = scheduledAt
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(scheduledAt))
    : "—";
  const estimate = optedInCount * ratePaise;
  const result = sendResult ?? cancelResult;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <CalendarClock className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Scheduled broadcast
          </h2>
          <p className="mt-0.5 text-sm text-neutral-600">
            Goes out automatically — the queue releases it on time.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            When
          </dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">
            {whenLabel}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Audience
          </dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">
            {audienceName}
            <span className="ml-1 text-xs font-normal text-neutral-500">
              ({optedInCount} opted in)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Est. cost
          </dt>
          <dd className="mt-1 text-sm font-medium text-neutral-900">
            {currencySymbol}{(estimate / 100).toFixed(2)}{" "}
            <span className="text-xs font-normal text-neutral-400">
              (estimate)
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center gap-3 border-t border-neutral-100 pt-4">
        <form action={sendNow}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button loading={sending} disabled={cancelling}>
            {simulation ? "Send now (test mode)" : "Send now"}
          </Button>
        </form>
        <form action={cancel}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button variant="secondary" loading={cancelling} disabled={sending}>
            Cancel schedule
          </Button>
        </form>
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
    </Card>
  );
}
