"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { QItem } from "@/modules/knowledge/questionnaire";
import {
  submitQuestionnaireAction,
  submitQuestionnaireAnswerAction,
} from "./actions";

type Mode = "form" | "interview";

const CATEGORY_TITLES: Record<string, string> = {
  menu_services: "What you offer",
  pricing: "Pricing",
  hours: "Hours",
  location: "Location & reach",
  policies: "Policies",
  payments: "Payments",
  faq: "Common questions",
  other: "About the business",
};

function FormMode({ script }: { script: QItem[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sections = useMemo(() => {
    const order: string[] = [];
    for (const q of script)
      if (!order.includes(q.category)) order.push(q.category);
    return order.map((cat) => ({
      cat,
      items: script.filter((q) => q.category === cat),
    }));
  }, [script]);

  const answeredCount = script.filter((q) => answers[q.id]?.trim()).length;

  return (
    <div className="flex flex-col gap-6">
      {sections.map((s) => (
        <Card key={s.cat} className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">
            {CATEGORY_TITLES[s.cat] ?? s.cat}
          </h3>
          <div className="flex flex-col gap-4">
            {s.items.map((q) => (
              <Field key={q.id} label={q.prompt} htmlFor={`q-${q.id}`}>
                <Textarea
                  id={`q-${q.id}`}
                  rows={2}
                  placeholder={q.placeholder}
                  value={answers[q.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                  disabled={pending}
                />
              </Field>
            ))}
          </div>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
        <span className="text-sm text-neutral-500">
          {answeredCount} of {script.length} answered — every answer makes the
          AI smarter.
        </span>
        <Button
          disabled={pending || answeredCount === 0}
          onClick={() =>
            startTransition(async () => {
              const r = await submitQuestionnaireAction(
                script
                  .filter((q) => answers[q.id]?.trim())
                  .map((q) => ({ id: q.id, answer: answers[q.id] }))
              );
              setMessage(r.message);
              if (r.ok) router.push("/knowledge");
            })
          }
        >
          {pending ? "Teaching your AI…" : "Save all answers"}
        </Button>
      </div>
      {message && <p className="text-sm text-neutral-500">{message}</p>}
    </div>
  );
}

function InterviewMode({ script }: { script: QItem[] }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [learned, setLearned] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const q = script[index];
  const done = index >= script.length;

  const advance = () => {
    setAnswer("");
    setIndex((i) => i + 1);
  };

  if (done) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-semibold text-neutral-900">
          That&apos;s the interview done 🎉
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Your AI learned {learned} fact{learned === 1 ? "" : "s"}. It keeps
          learning from every question you answer in the queue.
        </p>
        <Button className="mt-5" onClick={() => router.push("/knowledge")}>
          See what it knows
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-neutral-500">
          Question {index + 1} of {script.length}
        </span>
        <div className="w-40">
          <Progress value={(index / script.length) * 100} />
        </div>
      </div>

      <p className="text-[15px] font-medium text-neutral-900">{q.prompt}</p>
      <Textarea
        className="mt-3"
        rows={4}
        autoFocus
        placeholder={q.placeholder}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={pending}
      />
      <div className="mt-4 flex items-center gap-2">
        <Button
          disabled={pending || !answer.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await submitQuestionnaireAnswerAction(q.id, answer);
              if (r.ok) {
                setLearned((n) => n + (r.facts ?? 0));
                advance();
              }
            })
          }
        >
          {pending ? "Learning…" : "Next"}
          {!pending && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={advance}>
          Skip
        </Button>
        {learned > 0 && (
          <span className="ml-auto text-sm text-neutral-500">
            {learned} fact{learned === 1 ? "" : "s"} learned so far
          </span>
        )}
      </div>
    </Card>
  );
}

export function QuestionnaireClient({ script }: { script: QItem[] }) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (!mode) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("interview")}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <MessageCircle className="h-6 w-6 text-brand-600" />
          <span className="font-semibold text-neutral-900">
            Interview me (recommended)
          </span>
          <span className="text-sm text-neutral-500">
            Answer one question at a time, like chatting with a new employee on
            their first day.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("form")}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-neutral-200 bg-white p-6 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
        >
          <ClipboardList className="h-6 w-6 text-brand-600" />
          <span className="font-semibold text-neutral-900">
            Fill the form
          </span>
          <span className="text-sm text-neutral-500">
            See every question at once and fill what you want, in any order.
          </span>
        </button>
      </div>
    );
  }

  return mode === "form" ? (
    <FormMode script={script} />
  ) : (
    <InterviewMode script={script} />
  );
}
