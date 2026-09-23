"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { setAutoReplyAction } from "./profile-actions";

/**
 * Stop the AI answering, from the page that configures it — a label and a
 * switch in the Training header.
 *
 * Switching it back ON has its own place — the amber notice that appears the
 * moment it is off — so this only shows while it is on. It exists because the
 * retired Setup page held the only OFF switch in the product, and an owner
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
    <div className="flex items-center gap-2 text-sm text-neutral-700">
      <span id={labelId}>Auto-reply</span>
      <Switch
        checked={on}
        disabled={pending}
        aria-labelledby={labelId}
        onCheckedChange={(next) => {
          // Optimistic, then reconciled by the refresh: a failed save leaves
          // the switch saying the opposite of the truth otherwise.
          setOn(next);
          start(async () => {
            const r = await setAutoReplyAction(next);
            toast({ description: r.message, tone: r.ok ? "success" : "error" });
            if (!r.ok) setOn(!next);
            else router.refresh();
          });
        }}
      />
    </div>
  );
}
