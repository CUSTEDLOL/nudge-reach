import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import type { TrialWorkspace } from "@/modules/trial/workspace";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function endLabel(value: string | null) {
  if (!value) return "End date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "End date pending";
  return `Ends ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function trialStatusText(trial: TrialWorkspace) {
  if (trial.status === "exhausted") {
    return `${trial.replyLimit}-reply limit reached · AI replies are paused`;
  }
  if (trial.status === "expired") {
    return "Trial ended · AI replies are paused";
  }
  return `Free trial · ${trial.repliesRemaining} of ${trial.replyLimit} replies left · ${endLabel(trial.expiresAt)}`;
}

export function TrialStatusStrip({ trial }: { trial: TrialWorkspace }) {
  const stopped = trial.status === "exhausted" || trial.status === "expired";

  return (
    <div className="border-b border-brand-100 bg-brand-50/85 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-brand-900">Safe test workspace</p>
            <p aria-live="polite" className="text-xs leading-5 text-brand-900/65">
              {trialStatusText(trial)}
            </p>
          </div>
        </div>
        {stopped ? (
          <div className="flex items-center gap-3 pl-9 sm:pl-0">
            <BookDemoButton
              surface="trial-workspace"
              variant="primary"
              size="sm"
            >
              Book a free demo
            </BookDemoButton>
            <Link
              href="/pricing"
              className="text-xs font-semibold text-brand-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              See paid plans
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
