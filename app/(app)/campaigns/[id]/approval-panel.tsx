"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  refreshStatusAction,
  submitForApprovalAction,
  type ActionResult,
} from "../actions";

/**
 * Approval status + actions. While PENDING it re-checks every few seconds
 * (router.refresh triggers the server-side poll), so in simulation the
 * status flips to approved before your eyes.
 */
export function ApprovalPanel({
  campaignId,
  status,
  rejectionReason,
}: {
  campaignId: string;
  status: string;
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [result, submit, submitting] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      submitForApprovalAction(formData),
    null
  );

  useEffect(() => {
    if (status !== "TEMPLATE_PENDING") return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [status, router]);

  if (status === "TEMPLATE_PENDING") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="text-sm text-amber-800">
          <p className="font-semibold">⏳ Waiting for Meta&apos;s approval</p>
          <p className="mt-0.5">
            Usually minutes, sometimes hours. This page checks automatically.
          </p>
        </div>
        <form action={refreshStatusAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <button className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100">
            Check now
          </button>
        </form>
      </div>
    );
  }

  if (status === "TEMPLATE_APPROVED") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">✅ Approved — ready to send</p>
        <p className="mt-0.5">
          Picking an audience and sending arrives in the next build step.
          (Editing the campaign will need a fresh approval.)
        </p>
      </div>
    );
  }

  // DRAFT (possibly after a rejection)
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      {rejectionReason && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-semibold">Meta rejected the last submission:</p>
          <p className="mt-0.5">{rejectionReason}</p>
          <p className="mt-1 text-xs">
            Edit the message below and submit again — common fixes: clearer
            offer, no shortened links, no prohibited products.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Happy with the message? Send it to Meta for approval — required
          before any marketing send.
        </p>
        <form action={submit}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <button
            disabled={submitting}
            className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit for approval"}
          </button>
        </form>
      </div>
      {result && !result.ok && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.message}
        </p>
      )}
    </div>
  );
}
