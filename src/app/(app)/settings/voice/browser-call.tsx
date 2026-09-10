"use client";

import { useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Language } from "@elevenlabs/client";
import { Mic, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { browserCallErrorMessage } from "@/modules/voice/browser-call-errors";
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
    onError: (error: unknown) =>
      toast({ description: browserCallErrorMessage("call", error), tone: "error" }),
  });

  const live = conversation.status === "connected";
  const connecting = starting || conversation.status === "connecting";

  async function start() {
    setStarting(true);
    try {
      // Ask for the mic first: a denied prompt should fail before we mint a URL.
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Microphone capture is unavailable", "SecurityError");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        toast({ description: browserCallErrorMessage("microphone", error), tone: "error" });
        return;
      }

      const result = await startBrowserCallAction();
      if (!result.ok || !result.signedUrl || !result.callInit) {
        toast({ description: result.message, tone: "error" });
        return;
      }
      const config = result.callInit.conversation_config_override;
      conversation.startSession({
        signedUrl: result.signedUrl,
        connectionType: "websocket",
        dynamicVariables: result.callInit.dynamic_variables,
        overrides: {
          agent: {
            prompt: config.agent.prompt,
            firstMessage: config.agent.first_message,
            language: config.agent.language as Language,
          },
          ...(config.tts ? { tts: { voiceId: config.tts.voice_id } } : {}),
        },
      });
    } catch (error) {
      toast({
        description: browserCallErrorMessage("call", error),
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
    <div className="flex flex-col items-start gap-1.5">
      <Button type="button" variant="secondary" loading={connecting} onClick={start}>
        <Mic className="h-4 w-4" aria-hidden />
        Call your AI
      </Button>
      <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
        You&apos;ll speak with an AI assistant. The test call may be recorded and shared with your business team through the inbox.
      </p>
    </div>
  );
}

export function BrowserCallButton() {
  return (
    <ConversationProvider>
      <BrowserCallInner />
    </ConversationProvider>
  );
}
