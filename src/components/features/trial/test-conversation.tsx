import Link from "next/link";
import type { Ref } from "react";
import { Bot, LockKeyhole, UserRound } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { TrialTestInboxState } from "@/modules/trial/test-inbox";

function stoppedCopy(status: TrialTestInboxState["status"]) {
  if (status === "expired") {
    return "Your seven-day trial has ended. Your test conversation is still here.";
  }
  return "You have used all 15 AI replies. Your test conversation is still here.";
}

export function TestConversation({
  state,
  identityLabel,
  replyFocusRef,
}: {
  state: TrialTestInboxState;
  identityLabel: string;
  replyFocusRef?: Ref<HTMLLIElement>;
}) {
  const lastNudgeIndex = state.messages.findLastIndex(
    (message) => message.speaker === "nudge",
  );
  const stopped = state.status === "expired" || state.status === "exhausted";

  return (
    <Card className="overflow-hidden" data-tour="test-thread">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 px-4 py-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">
            Your private test inbox
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            <LockKeyhole className="h-3.5 w-3.5 text-brand-700" aria-hidden />
            {identityLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-800">
            {state.repliesRemaining} repl{state.repliesRemaining === 1 ? "y" : "ies"} left
          </span>
        </div>
      </div>

      <div className="min-h-72 bg-neutral-50/70 p-4 sm:p-6">
        {state.messages.length === 0 ? (
          <div className="mx-auto flex min-h-60 max-w-sm flex-col items-center justify-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-black/5">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-semibold text-neutral-900">
              Ask your first customer question
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Nudge will answer only from the business facts you approved.
            </p>
          </div>
        ) : (
          <ol className="mx-auto flex max-w-2xl flex-col gap-3">
            {state.messages.map((message, index) => {
              const fromCustomer = message.speaker === "customer";
              return (
                <li
                  key={message.id}
                  ref={!fromCustomer && index === lastNudgeIndex ? replyFocusRef : undefined}
                  tabIndex={!fromCustomer && index === lastNudgeIndex ? -1 : undefined}
                  className={cn(
                    "flex items-end gap-2 outline-none",
                    fromCustomer ? "justify-end" : "justify-start",
                  )}
                >
                  {!fromCustomer && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                      <Bot className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                      fromCustomer
                        ? "rounded-br-md bg-neutral-900 text-white"
                        : "rounded-bl-md bg-white text-neutral-800 ring-1 ring-black/5",
                      message.optimistic && "opacity-65",
                    )}
                  >
                    <span className="sr-only">
                      {fromCustomer ? "Test customer" : "Nudge"}: {" "}
                    </span>
                    {message.body}
                  </div>
                  {fromCustomer && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-600">
                      <UserRound className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {state.announcement ? `Nudge replied: ${state.announcement}` : ""}
        </p>
      </div>

      {stopped && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-amber-950">Your test is complete</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/70">
              {stoppedCopy(state.status)}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row">
            <BookDemoButton surface="trial_workspace" variant="primary" size="sm">
              Book a free demo
            </BookDemoButton>
            <Link href="/pricing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              See paid plans
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
