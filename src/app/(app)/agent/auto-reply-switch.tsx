"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { setAutoReplyAction } from "./setup-actions";

/**
 * Stop the AI answering, from the page that configures it.
 *
 * Switching it back ON has its own place — the amber notice that appears the
 * moment it is off — so this row only shows while it is on. It exists because
 * the retired Setup page held the only OFF switch in the product, and an owner
 * who wants to take over a busy WhatsApp for an afternoon must not have to ask
 * us to do it for them.
 */
export function AutoReplySwitch() {
  const { toast } = useToast();
  const router = useRouter();
  const labelId = useId();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(true);

  return (
    <Card className="flex items-start justify-between gap-4 p-5">
      <div>
        <p id={labelId} className="text-sm font-semibold text-neutral-900">
          Auto-reply is on
        </p>
        <p className="mt-0.5 text-sm text-neutral-500">
          Your AI answers new customer messages instantly. Switch it off to
          handle them yourself.
        </p>
      </div>
      <Switch
        checked={on}
        disabled={pending}
        aria-labelledby={labelId}
        onCheckedChange={(next) => {
          // Optimistic, then reconciled by the refresh: a failed save leaves
          // the row saying the opposite of the truth otherwise.
          setOn(next);
          start(async () => {
            const r = await setAutoReplyAction(next);
            toast({ description: r.message, tone: r.ok ? "success" : "error" });
            if (!r.ok) setOn(!next);
            else router.refresh();
          });
        }}
      />
    </Card>
  );
}
