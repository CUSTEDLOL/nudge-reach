"use client";

import { useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  connectCalendarAction,
  disconnectCalendarAction,
} from "./calendar-actions";

export function CalendarCard({
  connected,
  email,
  simulated,
  hasFrontDesk,
}: {
  connected: boolean;
  email?: string | null;
  simulated: boolean;
  hasFrontDesk: boolean;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await action();
      toast({
        title: r.ok ? "Google Calendar" : "Couldn't update calendar",
        description: r.message,
        tone: r.ok ? "success" : "error",
      });
    });

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CalendarClock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900">
                Google Calendar
              </h2>
              {connected ? (
                <Badge tone="success">Connected</Badge>
              ) : (
                <Badge tone="neutral">Not connected</Badge>
              )}
              <Badge tone="brand">AI Front Desk</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              {connected
                ? `The AI agent books real appointments${
                    email ? ` into ${email}` : ""
                  }${
                    simulated ? " (test calendar)" : ""
                  }, checks availability, and offers open slots.`
                : "Let the AI agent book straight into your calendar — check availability, create the event, send the confirmation. The moat Meta's free agent can't cross."}
            </p>
            {!hasFrontDesk && (
              <p className="mt-2 text-xs text-brand-700">
                Included with the AI Front Desk plan — upgrade in Settings →
                Billing to switch it on.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {connected ? (
            <Button
              variant="secondary"
              onClick={() => run(disconnectCalendarAction)}
              loading={pending}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => run(connectCalendarAction)}
              loading={pending}
              disabled={!hasFrontDesk}
            >
              Connect calendar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
