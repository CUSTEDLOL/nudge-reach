"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Mic, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { startBrowserCallAction } from "./actions";

/**
 * "Call your AI" — speak to the front desk from this page, no phone number
 * needed. The heavy lifting is ElevenLabs'; we only hand the browser a
 * short-lived signed URL minted server-side.
 */
function BrowserCallInner() {
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);
  const conversation = useConversation({
    onError: (message: unknown) =>
      toast({ description: String(message) || "The call dropped.", tone: "error" }),
  });

  const live = conversation.status === "connected";
  const connecting = starting || conversation.status === "connecting";

  async function start() {
    setStarting(true);
    try {
      // Ask for the mic first: a denied prompt should fail before we mint a URL.
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const result = await startBrowserCallAction();
      if (!result.ok || !result.signedUrl) {
        toast({ description: result.message, tone: "error" });
        return;
      }
      conversation.startSession({ signedUrl: result.signedUrl, connectionType: "websocket" });
    } catch {
      toast({
        description: "We couldn't reach your microphone. Allow mic access and try again.",
        tone: "error",
      });
    } finally {
      setStarting(false);
    }
  }

  if (live) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success">
          {conversation.isSpeaking ? "Your AI is talking" : "Listening…"}
        </Badge>
        <Button type="button" variant="secondary" onClick={() => conversation.endSession()}>
          <PhoneOff className="h-4 w-4" aria-hidden />
          Hang up
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" variant="secondary" loading={connecting} onClick={start}>
      <Mic className="h-4 w-4" aria-hidden />
      Call your AI
    </Button>
  );
}

export function BrowserCallButton() {
  return (
    <ConversationProvider>
      <BrowserCallInner />
    </ConversationProvider>
  );
}
