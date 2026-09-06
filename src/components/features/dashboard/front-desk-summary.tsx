import Link from "next/link";
import { ArrowRight, Bot, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCount } from "@/modules/dashboard/format";

export function FrontDeskSummary({
  openConversations,
  bookingsThisMonth,
  followUpsThisMonth,
  handoffCount,
  followupsEnabled,
  simulationMode,
  showBusinessOutcomes = true,
}: {
  openConversations: number;
  bookingsThisMonth: number;
  followUpsThisMonth: number;
  handoffCount: number;
  followupsEnabled: boolean;
  simulationMode: boolean;
  showBusinessOutcomes?: boolean;
}) {
  return (
    <section aria-labelledby="front-desk-heading">
      <Card className="overflow-hidden border-brand-100 shadow-none">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Bot className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="front-desk-heading"
                  className="text-lg font-semibold tracking-tight text-neutral-950"
                >
                  AI Front Desk activity
                </h2>
                <Badge tone={simulationMode ? "info" : "success"}>
                  {simulationMode ? "Test mode" : "Live workspace"}
                </Badge>
                {!followupsEnabled && showBusinessOutcomes && (
                  <Badge tone="warning">
                    <RefreshCw className="h-3 w-3" aria-hidden />
                    Follow-ups paused
                  </Badge>
                )}
              </div>
              <p className="mt-2 max-w-3xl text-[15px] leading-6 text-neutral-700">
                Your Front Desk is monitoring {formatCount(openConversations)} open
                conversation{openConversations === 1 ? "" : "s"}.
                {showBusinessOutcomes && (
                  <>
                    {" "}This month, it captured {formatCount(bookingsThisMonth)} booking
                    {bookingsThisMonth === 1 ? "" : "s"} and sent {formatCount(followUpsThisMonth)} follow-up
                    {followUpsThisMonth === 1 ? "" : "s"}.
                  </>
                )}{" "}
                {handoffCount > 0
                  ? `${formatCount(handoffCount)} conversation${handoffCount === 1 ? " is" : "s are"} waiting for a person.`
                  : "Nothing is waiting for a handoff."}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            {showBusinessOutcomes && !followupsEnabled && (
              <Link
                href="/automations"
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm",
                  className: "w-full sm:w-auto",
                })}
              >
                Review follow-ups
              </Link>
            )}
            <Link
              href="/agent"
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "w-full sm:w-auto",
              })}
            >
              Open Front Desk
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
