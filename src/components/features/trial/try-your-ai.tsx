"use client";

import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef, useState } from "react";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { TestConversation } from "@/components/features/trial/test-conversation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { ThreadSnapshot } from "@/modules/inbox/queries";
import type { TrialReplySummary } from "@/modules/trial/replies";
import {
  createTrialTestInboxState,
  reduceTrialTestInbox,
  trialConversationDestination,
} from "@/modules/trial/test-inbox";
import type { TrialWorkspace } from "@/modules/trial/workspace";
import { simulateInboundAction } from "@/app/(app)/inbox/actions";

const STARTERS = [
  "What are your timings?",
  "How much does your service cost?",
  "Can I book for tomorrow at 5pm?",
  "Do you have parking?",
];

export function TryYourAi({
  simulation,
  dialCode,
  connectedName,
  trial,
  testIdentity,
  initialMessages = [],
}: {
  simulation: boolean;
  dialCode: string;
  connectedName: string | null;
  trial: TrialWorkspace | null;
  testIdentity: { label: string } | null;
  initialMessages?: ThreadSnapshot["messages"];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState("9876500001");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [needsKnowledge, setNeedsKnowledge] = useState(false);
  const initialTrial = trial ?? {
      status: "active" as const,
      repliesUsed: 0,
      replyLimit: 15,
      repliesRemaining: 15,
    };
  const [trialState, dispatchTrial] = useReducer(
    reduceTrialTestInbox,
    undefined,
    () => createTrialTestInboxState(initialTrial, initialMessages),
  );
  const keyboardSubmitRef = useRef(false);
  const focusReplyRef = useRef(false);
  const replyFocusRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (
      focusReplyRef.current &&
      trialState.phase === "ready" &&
      trialState.announcement
    ) {
      replyFocusRef.current?.focus();
      focusReplyRef.current = false;
    }
  }, [trialState.phase, trialState.announcement]);

  async function send(keyboardSubmit: boolean) {
    const body = text.trim();
    if (
      sending
      || !body
      || (trial && !trialState.composerEnabled)
      || (trial && !testIdentity)
    ) {
      return;
    }

    if (trial) dispatchTrial({ type: "sent", body });
    setSending(true);
    let actionSucceeded = false;
    let authoritativeTrial: TrialReplySummary | undefined;
    try {
      const fd = new FormData();
      if (!trial) fd.set("phone", phone);
      fd.set("text", body);
      const result = await simulateInboundAction(fd);
      authoritativeTrial = result.trial;
      if (!result.ok) {
        setNeedsKnowledge(result.skipped === "no_knowledge");
        if (trial) dispatchTrial({ type: "failed", trial: result.trial });
        if (result.trial) router.refresh();
        toast({ tone: "error", description: result.message });
        return;
      }
      actionSucceeded = true;
      setNeedsKnowledge(false);
      router.refresh();
      if (result.skipped) toast({ tone: "error", description: result.message });
      if (result.conversationId) {
        const destination = trialConversationDestination(
          Boolean(trial),
          result.conversationId,
        );
        if (destination) {
          router.push(destination);
          return;
        }

        const response = await fetch(
          `/api/inbox/${result.conversationId}/messages`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("thread snapshot failed");
        const snapshot = (await response.json()) as ThreadSnapshot;
        focusReplyRef.current = keyboardSubmit;
        dispatchTrial({
          type: "snapshot",
          messages: snapshot.messages,
          trial: result.trial,
        });
        setText("");
        return;
      }
      if (trial) dispatchTrial({ type: "failed", trial: result.trial });
      toast({ tone: "success", description: result.message });
    } catch {
      if (trial) {
        dispatchTrial({
          type: actionSucceeded ? "snapshot_failed" : "failed",
          trial: authoritativeTrial,
        });
      }
      toast({
        tone: "error",
        description: actionSucceeded
          ? "Your message was saved, but the conversation couldn't refresh. Reload to see it."
          : "The simulated message failed — try again.",
      });
    } finally {
      setSending(false);
    }
  }

  const composerDisabled =
    sending || Boolean(trial && !trialState.composerEnabled);

  return (
    <div className="space-y-4">
      {trial && testIdentity && (
        <TestConversation
          state={trialState}
          identityLabel={testIdentity.label}
          replyFocusRef={replyFocusRef}
          needsKnowledge={needsKnowledge}
        />
      )}
      <Card className="p-4 sm:p-6" data-tour="test-composer">
        {!simulation && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              aria-hidden
            />
            <span>
              This tester uses a private test number, so nothing is sent to
              a real phone.
              {connectedName
                ? ` To test on a real phone, message “${connectedName}” from WhatsApp.`
                : ""}
            </span>
          </p>
        )}
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const keyboardSubmit = keyboardSubmitRef.current;
            keyboardSubmitRef.current = false;
            void send(keyboardSubmit);
          }}
        >
          {!trial && (
            <div>
              <Label htmlFor="try-phone">
                Test customer&apos;s number (any number works)
              </Label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-sm text-neutral-500">{dialCode}</span>
                <Input
                  id="try-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="max-w-xs"
                  disabled={composerDisabled}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-400">
                Change the number to start a fresh conversation.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="try-text">Message as the customer</Label>
            <Textarea
              id="try-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder="e.g. Are you open on Sunday?"
              className="mt-1.5"
              disabled={composerDisabled}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  keyboardSubmitRef.current = true;
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setText(starter)}
                  disabled={composerDisabled}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-brand-400 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Replies use only the facts on your AI Front Desk page — teach it
              more and try again.
            </p>
            <div className="flex shrink-0 items-center gap-3">
              {trial && (
                <span className="text-xs font-medium text-neutral-500">
                  {trialState.repliesRemaining} test repl
                  {trialState.repliesRemaining === 1 ? "y" : "ies"} left
                </span>
              )}
              <Button
                type="submit"
                loading={sending}
                disabled={!text.trim() || composerDisabled}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    keyboardSubmitRef.current = true;
                  }
                }}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
                Send as customer
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
