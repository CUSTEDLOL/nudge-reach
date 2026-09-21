"use client";

import { useState, useTransition } from "react";
import { Lock, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { FollowUpSpec } from "@/modules/followup/spec";
import {
  createFollowUpAction,
  draftFollowUpAction,
  writeStarterSetAction,
} from "./followup-actions";
import { SpecEditor } from "./spec-editor";

const EXAMPLES: Record<string, string[]> = {
  clinic: [
    "Chase anyone who asked about pricing but didn't book, after 2 days, then once more a week later",
    "The day after a consultation, ask how it went and invite questions",
    "Welcome every new lead and tell them our consultation hours",
  ],
  salon: [
    "Nudge clients who went quiet after asking for a slot, after 2 days",
    "Ask for a review the day after an appointment",
    "Remind everyone who booked that we're open on Sundays",
  ],
};

const DEFAULT_EXAMPLES = [
  "Chase anyone who went quiet after showing interest, after 2 days, then once more 5 days later",
  "Thank people the day after their appointment and ask how it went",
  "Welcome every new lead with what we do and how to book",
];

function BarFrame({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </Card>
  );
}

export function FollowUpBar({
  vertical,
  canManage,
  hasFrontDesk,
  planName,
  hasSpecFollowUps,
}: {
  vertical: string;
  canManage: boolean;
  /** Drafting is flagship-only. Without it the bar still renders — locked —
   *  because it is the only thing above the empty state. */
  hasFrontDesk: boolean;
  /** Cheapest plan that includes AI Front Desk, named in the locked copy.
   *  Passed down: this is a client component, billing/limits is server-side. */
  planName: string;
  /** Has the org any AI-written follow-up yet? A builder-only org is still
   *  offered the starter set. */
  hasSpecFollowUps: boolean;
}) {
  const { toast } = useToast();
  const [request, setRequest] = useState("");
  const [draft, setDraft] = useState<FollowUpSpec | null>(null);
  // The starter set costs a model call, so it is offered once per session —
  // the action's own "already here" reply covers a second tab.
  const [done, setDone] = useState(false);
  // Two transitions, so writing the starter set doesn't spin "Draft it".
  const [drafting, startDraft] = useTransition();
  const [starting, startStarter] = useTransition();
  const pending = drafting || starting;
  const examples = EXAMPLES[vertical] ?? DEFAULT_EXAMPLES;

  function draftIt() {
    startDraft(async () => {
      const r = await draftFollowUpAction(request);
      if (r.ok && r.spec) setDraft(r.spec);
      else toast({ description: r.message, tone: "error" });
    });
  }

  function createIt() {
    if (!draft) return;
    startDraft(async () => {
      const r = await createFollowUpAction(draft);
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      // The server repairs what it stores; the saved follow-up now renders from
      // its own card, so the draft is dropped rather than kept.
      if (r.ok) {
        setDraft(null);
        setRequest("");
      }
    });
  }

  function starter() {
    startStarter(async () => {
      const r = await writeStarterSetAction();
      toast({ description: r.message, tone: r.ok ? "success" : "error" });
      if (r.ok) setDone(true);
    });
  }

  if (!canManage) return null;

  // Locked, not missing: on Free/Entry/Starter this card is the only thing
  // above the list, and the builder genuinely still works (saveAutomation is
  // role-gated, not plan-gated).
  if (!hasFrontDesk) {
    return (
      <BarFrame>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Lock className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
          Describe a follow-up
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          {"Describe a follow-up in plain English and the AI writes it. "}
          {`Available from the ${planName} plan — upgrade in Settings → Billing. `}
          {"You can still build one by hand."}
        </p>
      </BarFrame>
    );
  }

  return (
    <BarFrame>
      <h2 className="text-sm font-semibold text-neutral-900">
        Describe a follow-up
      </h2>
      <p className="mt-0.5 text-sm text-neutral-500">
        Say who, when and what — the AI writes the message and the timing. You
        review it before anything is created.
      </p>
      <Textarea
        value={request}
        disabled={pending}
        maxLength={500}
        placeholder={examples[0]}
        aria-label="Describe a follow-up"
        onChange={(e) => setRequest(e.target.value)}
        className="mt-3"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={pending}
            onClick={() => setRequest(ex)}
            className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 outline-none transition-colors duration-150 hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-brand-400/50 disabled:opacity-60"
          >
            {ex}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          onClick={draftIt}
          loading={drafting}
          disabled={!request.trim() || pending}
        >
          <Wand2 className="h-4 w-4" aria-hidden />
          Draft it
        </Button>
        {!hasSpecFollowUps && (
          <span className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={starter}
              loading={starting}
              disabled={done || pending}
            >
              Write my starter set
            </Button>
            <span className="text-xs text-neutral-500">
              Uses about 5 AI credits
            </span>
          </span>
        )}
      </div>
      {draft && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4">
          <SpecEditor spec={draft} onChange={setDraft} disabled={pending} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={createIt} loading={drafting} disabled={pending}>
              Create follow-up
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={pending}
            >
              Discard
            </Button>
            <span className="text-xs text-neutral-500">
              It starts off. Its messages go to Meta for approval before they
              can send.
            </span>
          </div>
        </div>
      )}
    </BarFrame>
  );
}
