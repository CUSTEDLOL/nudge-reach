"use client";

import { useState, useTransition } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { answerQuestionAction, dismissQuestionAction } from "./actions";

export interface QueueItem {
  id: string;
  question: string;
  askCount: number;
  waitingCount: number;
  askedAt: string;
}

function QuestionCard({
  q,
  canEdit,
}: {
  q: QueueItem;
  canEdit: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setMessage(r.message);
      if (r.ok) setAnswer("");
    });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[15px] font-medium text-neutral-900">
          “{q.question}”
        </p>
        <span className="shrink-0 text-xs font-medium text-neutral-500">
          asked {q.askCount}×
          {q.waitingCount > 0 &&
            ` · ${q.waitingCount} customer${q.waitingCount === 1 ? "" : "s"} waiting`}
        </span>
      </div>
      <div className="mt-3">
        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={2}
          placeholder='Type the answer as you would to a colleague — e.g. "yes, but only on weekends"'
          disabled={!canEdit || pending}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={!canEdit || pending || answer.trim().length === 0}
          onClick={() => run(() => answerQuestionAction(q.id, answer))}
        >
          {pending ? "Saving…" : "Answer & teach the AI"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canEdit || pending}
          onClick={() => run(() => dismissQuestionAction(q.id))}
        >
          Dismiss
        </Button>
        {message && (
          <span className="text-sm text-neutral-500">{message}</span>
        )}
      </div>
    </Card>
  );
}

export function Queue({
  items,
  canEdit,
}: {
  items: QueueItem[];
  canEdit: boolean;
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon={<HelpCircle className="h-5 w-5" />}
        title="Nothing needs your answer"
        description="When the AI hits a question it can't answer, it asks you here — and every answer makes it smarter, permanently."
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((q) => (
        <QuestionCard key={q.id} q={q} canEdit={canEdit} />
      ))}
    </div>
  );
}
