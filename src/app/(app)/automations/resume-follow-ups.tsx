"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toggleRevenueRecoveryAction } from "./followup-actions";

/**
 * The paused state, with the one control that actually leaves it.
 *
 * A pause sets `followUpConfig.enabled = false` but clears no per-row flag, so
 * the three tick rows still read On — telling the owner to "switch one back on"
 * pointed at nothing. This calls the pack toggle, whose enabling branch runs
 * `installRevenueRecoveryPack` + `setFollowUpEnabled(true)`: it reinstalls
 * anything missing and resumes the quiet-lead nudge with it.
 */
export function ResumeFollowUps() {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  function resume() {
    start(async () => {
      const r = await toggleRevenueRecoveryAction();
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
    });
  }

  return (
    <Button size="sm" onClick={resume} loading={pending}>
      <Play className="h-3.5 w-3.5" aria-hidden />
      Resume follow-ups
    </Button>
  );
}
