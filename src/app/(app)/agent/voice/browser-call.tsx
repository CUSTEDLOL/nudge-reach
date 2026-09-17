"use client";

import { useEffect, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { Language } from "@elevenlabs/client";
import { Mic, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  browserCallErrorMessage,
  microphoneStateAfterError,
  microphoneStateFromPermission,
  requestMicrophoneAccess,
  type MicrophoneUiState,
} from "@/modules/voice/browser-call-errors";
import { startBrowserCallAction } from "./actions";

/**
 * "Call your AI" — speak to the front desk from this page, no phone number
 * needed. The heavy lifting is ElevenLabs'; we only hand the browser a
 * short-lived signed URL minted server-side.
 */
function BrowserCallInner() {
  const { toast } = useToast();
  const [starting, setStarting] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const [microphone, setMicrophone] = useState<MicrophoneUiState>("checking");
  const conversation = useConversation({
    onError: (error: unknown) =>
      toast({ description: browserCallErrorMessage("call", error), tone: "error" }),
  });

  const live = conversation.status === "connected";
  const connecting = starting || conversation.status === "connecting";

  useEffect(() => {
    let active = true;
    let status: PermissionStatus | null = null;
    const syncPermission = () => {
      if (active && status) {
        setMicrophone(microphoneStateFromPermission(status.state, true));
      }
    };
    async function detectPermission() {
      // Defer the browser-only check so the effect does not synchronously
      // cascade into a second render after hydration.
      await Promise.resolve();
      if (!active) return;

      const supported = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
      if (!supported) {
        setMicrophone("unsupported");
        return;
      }
      if (!navigator.permissions?.query) {
        setMicrophone("prompt");
        return;
      }

      try {
        status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (!active) return;
        syncPermission();
        status.addEventListener("change", syncPermission);
      } catch {
        if (active) setMicrophone("prompt");
      }
    }
    void detectPermission();

    return () => {
      active = false;
      status?.removeEventListener("change", syncPermission);
    };
  }, []);

  async function enableMicrophone() {
    setRequestingMicrophone(true);
    try {
      const granted = await requestMicrophoneAccess({
        isSecureContext: window.isSecureContext,
        getUserMedia: navigator.mediaDevices?.getUserMedia
          ? () => navigator.mediaDevices.getUserMedia({ audio: true })
          : undefined,
      });
      setMicrophone(granted);
      toast({ description: "Microphone enabled. You can start your test call.", tone: "success" });
    } catch (error) {
      setMicrophone(microphoneStateAfterError(error));
      toast({ description: browserCallErrorMessage("microphone", error), tone: "error" });
    } finally {
      setRequestingMicrophone(false);
    }
  }

  async function start() {
    setStarting(true);
    try {
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
      {microphone === "granted" ? (
        <>
          <Button type="button" variant="secondary" loading={connecting} onClick={start}>
            <Mic className="h-4 w-4" aria-hidden />
            Call your AI
          </Button>
          <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
            Microphone ready. The test call may be recorded and shared with your business team through the inbox.
          </p>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            loading={requestingMicrophone || microphone === "checking"}
            disabled={microphone === "unsupported"}
            onClick={enableMicrophone}
          >
            <Mic className="h-4 w-4" aria-hidden />
            {microphone === "denied" ? "Try microphone again" : "Enable microphone"}
          </Button>
          <p className="max-w-xs text-xs leading-relaxed text-neutral-500" aria-live="polite">
            {microphone === "checking" && "Checking microphone access…"}
            {microphone === "prompt" && "Your browser will ask you to allow microphone access."}
            {microphone === "denied" && "Permission is blocked. Set Microphone to Allow in this site's browser settings, then try again."}
            {microphone === "unsupported" && "Microphone access requires a supported browser on a secure page."}
          </p>
        </>
      )}
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
