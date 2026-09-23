"use client";

import Link from "next/link";
import { useTransition } from "react";
import { PowerOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setAutoReplyAction } from "@/app/(app)/agent/profile-actions";

/**
 * One line, one button. Owners hit "Try it in chat" and got silence because
 * nothing on Home or Training said the AI was switched off. Shown wherever
 * an owner or admin would expect the AI to be answering.
 */
export function AiOffNotice({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
          <PowerOff className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-950">Your AI is switched off</p>
          <p className="mt-0.5 text-sm text-neutral-700">
            It won&apos;t reply to anyone — not customers, not you in Try your AI — until it&apos;s on.
          </p>
        </div>
      </div>
      {canEdit ? (
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await setAutoReplyAction(true);
              toast({ description: r.message, tone: r.ok ? "success" : "error" });
            })
          }
        >
          Turn it on
        </Button>
      ) : (
        <Link href="/agent" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Ask an admin
        </Link>
      )}
    </div>
  );
}
