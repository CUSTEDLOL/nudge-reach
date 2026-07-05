"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      <Card className="flex items-center justify-between gap-4 border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3 text-sm text-amber-800">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Waiting for Meta&apos;s approval</p>
            <p className="mt-0.5">
              Usually minutes, sometimes hours. This page checks automatically.
            </p>
          </div>
        </div>
        <form action={refreshStatusAction}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button
            variant="secondary"
            size="sm"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            Check now
          </Button>
        </form>
      </Card>
    );
  }

  if (status === "TEMPLATE_APPROVED") {
    return (
      <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="flex items-center gap-1.5 font-semibold">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          Approved — ready to send
        </p>
        <p className="mt-0.5">
          Pick an audience below to send now or schedule it. (Editing the
          message needs a fresh approval.)
        </p>
      </Card>
    );
  }

  // DRAFT (possibly after a rejection)
  return (
    <Card className="p-4">
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
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">
          Happy with the message? Send it to Meta for approval — required
          before any marketing send.
        </p>
        <form action={submit}>
          <input type="hidden" name="campaignId" value={campaignId} />
          <Button loading={submitting} className="whitespace-nowrap">
            {submitting ? "Submitting…" : "Submit for approval"}
          </Button>
        </form>
      </div>
      {result && !result.ok && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.message}
        </p>
      )}
    </Card>
  );
}
