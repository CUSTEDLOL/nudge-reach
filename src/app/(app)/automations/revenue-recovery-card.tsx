"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { toggleRevenueRecoveryAction } from "./followup-actions";

export function RevenueRecoveryCard({
  enabled,
  hasFrontDesk,
  bookingsThisMonth,
  followUpsThisMonth,
  canManage,
}: {
  enabled: boolean;
  hasFrontDesk: boolean;
  bookingsThisMonth: number;
  followUpsThisMonth: number;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const r = await toggleRevenueRecoveryAction();
      toast({
        title: "Ready-made follow-ups",
        description: r.message,
        tone: r.ok ? "success" : "error",
      });
    });
  }

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">
                Ready-made follow-ups
              </h2>
              {enabled ? (
                <Badge tone="success">On</Badge>
              ) : (
                <Badge tone="neutral">Off</Badge>
              )}
              <Badge tone="brand">AI Front Desk</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Turning this on installs six written-for-you message templates and
              switches on the four follow-ups below. Every word is yours to edit,
              and each template goes to Meta for approval before it sends.
            </p>
            {enabled && (
              <p className="mt-2 text-xs text-neutral-500">
                {bookingsThisMonth.toLocaleString("en-IN")} bookings ·{" "}
                {followUpsThisMonth.toLocaleString("en-IN")} follow-ups sent this
                month
              </p>
            )}
            {!hasFrontDesk && (
              <p className="mt-2 text-xs text-brand-700">
                Included with the AI Front Desk plan — upgrade in Settings →
                Billing.
              </p>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant={enabled ? "secondary" : "primary"}
              onClick={toggle}
              loading={pending}
              disabled={!hasFrontDesk}
            >
              {enabled ? "Pause" : "Turn on"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
