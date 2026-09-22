import Link from "next/link";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { TrialEmailVerification } from "@/components/features/trial/trial-email-verification";
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

export function TrialStatusStrip({
  trial,
  email,
}: {
  trial: TrialWorkspace;
  email: string;
}) {
  const stopped = trial.status === "exhausted" || trial.status === "expired";

  return (
    <div className="border-b border-brand-100 bg-brand-50/85 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand-900">Safe test workspace</p>
          <p aria-live="polite" className="text-xs leading-5 text-brand-900/65">
            {trialStatusText(trial)}
          </p>
          {!trial.emailVerified && trial.status === "active" ? (
            <TrialEmailVerification trialId={trial.id} email={email} />
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <details className="text-xs text-brand-900">
            <summary className="cursor-pointer font-semibold underline decoration-brand-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              How to use this trial
            </summary>
            <ol className="mt-2 space-y-1.5 border-l border-brand-200 pl-3 leading-5 text-brand-900/70">
              <li>1. Add business information in Train AI.</li>
              <li>2. Ask a customer question in Inbox.</li>
              <li>3. Review the reply and update your information if needed.</li>
            </ol>
          </details>
          {stopped ? (
            <div className="flex items-center gap-3">
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
    </div>
  );
}
