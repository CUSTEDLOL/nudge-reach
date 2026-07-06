"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, FileText, Send } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { submitTemplateAction } from "../actions";

/**
 * Review-status panel for the template detail page. While PENDING it polls
 * GET /api/templates/[id]/status every 4s (which advances the simulated Meta
 * review) and refreshes the page once the review settles.
 */
export function StatusBanner({
  templateId,
  status,
  rejectionReason,
  canManage,
}: {
  templateId: string;
  status: string;
  rejectionReason: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, startTransition] = useTransition();
  // Optimistic status override, keyed to the server prop it advanced from —
  // once router.refresh() delivers a new prop, the prop wins again.
  const [override, setOverride] = useState<{ from: string; to: string } | null>(
    null
  );
  const liveStatus = override && override.from === status ? override.to : status;

  useEffect(() => {
    if (liveStatus !== "PENDING") return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/templates/${templateId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string };
        if (cancelled || !body.status || body.status === "PENDING") return;
        setOverride({ from: status, to: body.status });
        toast({
          tone: body.status === "APPROVED" ? "success" : "error",
          title:
            body.status === "APPROVED" ? "Template approved" : "Template rejected",
          description:
            body.status === "APPROVED"
              ? "It's ready to use in campaigns and inbox replies."
              : "Meta rejected this template — the reason is shown below.",
        });
        router.refresh();
      } catch {
        // transient network error — next tick retries
      }
    }

    const interval = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [liveStatus, status, templateId, router, toast]);

  function submit() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", templateId);
      const result = await submitTemplateAction(formData);
      toast({
        tone: result.ok ? "success" : "error",
        description: result.message,
      });
      if (result.ok) {
        setOverride({ from: status, to: "PENDING" });
        router.refresh();
      }
    });
  }

  const panel = "mb-6 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm";

  if (liveStatus === "PENDING") {
    return (
      <div className={cn(panel, "border-amber-200 bg-amber-50 text-amber-800")}>
        <Spinner size="sm" label="Review in progress" />
        <span>
          <span className="font-medium">Meta is reviewing this template.</span>{" "}
          Simulated review — usually settles in about 10 seconds.
        </span>
      </div>
    );
  }

  if (liveStatus === "APPROVED") {
    return (
      <div className={cn(panel, "border-emerald-200 bg-emerald-50 text-emerald-800")}>
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Approved.</span> Ready to use in
          campaigns and inbox replies. Editing moves it back to draft for
          re-approval.
        </span>
      </div>
    );
  }

  if (liveStatus === "REJECTED") {
    return (
      <div className={cn(panel, "items-start border-red-200 bg-red-50 text-red-800")}>
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Rejected by Meta.</p>
          {rejectionReason && <p className="mt-0.5">{rejectionReason}</p>}
          <p className="mt-0.5 text-red-700/80">
            Fix the content below, then resubmit.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={submit} loading={submitting}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            Resubmit
          </Button>
        )}
      </div>
    );
  }

  // DRAFT
  return (
    <div className={cn(panel, "border-black/5 bg-white text-neutral-600 shadow-soft")}>
      <FileText className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      <span className="flex-1">
        <span className="font-medium text-neutral-800">Draft.</span> Submit it
        for Meta review to use it in campaigns and replies.
      </span>
      {canManage && (
        <Button size="sm" onClick={submit} loading={submitting}>
          <Send className="h-3.5 w-3.5" aria-hidden />
          Submit for review
        </Button>
      )}
    </div>
  );
}
