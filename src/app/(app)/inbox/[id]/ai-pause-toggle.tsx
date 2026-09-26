"use client";

import { useState } from "react";
import { Bot, Loader2, PauseCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { setAiPausedAction } from "../actions";

/**
 * Human takeover switch in the thread header. "AI on" means the agent answers
 * the next customer message; "AI paused" means it stays silent until resumed.
 * Sending a reply from the composer pauses it automatically (server-side).
 */
export function AiPauseToggle({
  conversationId,
  paused,
  onChanged,
}: {
  conversationId: string;
  paused: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("paused", String(!paused));
    const result = await setAiPausedAction(fd);
    setPending(false);
    toast({ tone: result.ok ? "success" : "error", description: result.message });
    if (result.ok) onChanged();
  }

  const Icon = pending ? Loader2 : paused ? PauseCircle : Bot;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={paused}
      title={
        paused
          ? "AI is paused on this chat — click to let it reply again"
          : "AI is replying on this chat — click to pause it and reply yourself"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#00a884] disabled:opacity-60",
        paused
          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
          : "bg-[#d9fdd3] text-[#008069] hover:bg-[#c5f5bd]"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
      {paused ? "AI paused · Resume" : "AI on · Pause"}
    </button>
  );
}
