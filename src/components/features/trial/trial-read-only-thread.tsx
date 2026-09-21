import Link from "next/link";
import { ArrowLeft, Bot, LockKeyhole, UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ThreadMessage } from "@/modules/inbox/queries";

export function TrialReadOnlyThread({
  identityLabel,
  messages,
}: {
  identityLabel: string;
  messages: ThreadMessage[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Shared inbox preview
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            See how your private test conversation appears to your team.
          </p>
        </div>
        <Link
          href="/inbox/try"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Test Inbox
        </Link>
      </div>

      <Card className="mx-auto max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-4 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <LockKeyhole className="h-4 w-4 text-brand-700" aria-hidden />
            {identityLabel}
          </p>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
            Read only
          </span>
        </div>

        <ol className="flex min-h-96 flex-col gap-3 bg-neutral-50/70 p-4 sm:p-6">
          {messages.map((message) => {
            const fromCustomer = message.direction === "inbound";
            return (
              <li
                key={message.id}
                className={cn(
                  "flex items-end gap-2",
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

        <p className="border-t border-neutral-100 px-4 py-3 text-center text-xs text-neutral-500 sm:px-6">
          The paid shared inbox adds assignments, notes, status controls, and live WhatsApp replies.
        </p>
      </Card>
    </div>
  );
}
