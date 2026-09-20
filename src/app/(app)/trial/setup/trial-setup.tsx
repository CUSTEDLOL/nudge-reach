"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  Building2,
  Check,
  FileUp,
  Globe2,
  HelpCircle,
  Loader2,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  approveAllDraftsAction,
  approveDraftAction,
  discardDraftAction,
  importFileAction,
  importGbpAction,
  importWebsiteAction,
} from "@/app/(app)/agent/training-actions";
import { submitQuestionnaireAction } from "@/app/(app)/agent/questionnaire/actions";
import type {
  TrialKnowledgeSource,
  TrialWorkspace,
} from "@/modules/trial/workspace";
import { completeTrialSetupAction } from "./actions";

export interface TrialDraftFact {
  id: string;
  category: string;
  fact: string;
  condition: string | null;
}

export interface TrialQuestion {
  id: string;
  prompt: string;
  placeholder: string;
}

export function trialSetupStage(
  workspace: TrialWorkspace,
  draftCount: number,
): "source" | "review" | "ready" {
  if (workspace.knowledgeReady && draftCount === 0) return "ready";
  if (workspace.knowledgeSource) return "review";
  return "source";
}

const sourceCards = [
  { key: "website", label: "Website", hint: "Paste your clinic website", icon: Globe2 },
  { key: "gbp", label: "Google Business Profile", hint: "Find your listing by name and city", icon: Building2 },
  { key: "file", label: "File", hint: "Upload a PDF, menu, or rate-card image", icon: FileUp },
  { key: "interview", label: "Answer 5 questions", hint: "Type the essentials in one short form", icon: HelpCircle },
] as const;

export function TrialSetup({
  workspace,
  drafts,
  questions,
}: {
  workspace: TrialWorkspace;
  drafts: TrialDraftFact[];
  questions: TrialQuestion[];
}) {
  const stage = trialSetupStage(workspace, drafts.length);
  const [selectedSource, setSelectedSource] = useState<TrialKnowledgeSource | null>(
    workspace.knowledgeSource,
  );

  return (
    <div className="mx-auto max-w-3xl py-4 sm:py-8">
      <div className="mb-8 flex items-center justify-center gap-2" aria-label="Setup progress">
        {["Teach", "Review", "Test"].map((label, index) => {
          const active = stage === "source" ? 0 : stage === "review" ? 1 : 2;
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index <= active ? "bg-brand-600 text-white" : "bg-neutral-200 text-neutral-500"}`}>
                {index + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:inline ${index === active ? "text-neutral-900" : "text-neutral-400"}`}>{label}</span>
              {index < 2 ? <span className="h-px w-8 bg-neutral-200 sm:w-14" aria-hidden /> : null}
            </div>
          );
        })}
      </div>

      {stage === "source" ? (
        <SourceStep
          selected={selectedSource}
          onSelect={setSelectedSource}
          questions={questions}
        />
      ) : null}
      {stage === "review" ? <ReviewStep drafts={drafts} /> : null}
      {stage === "ready" ? <ReadyStep factCount={workspace.knowledgeCount} /> : null}
    </div>
  );
}

function SourceStep({
  selected,
  onSelect,
  questions,
}: {
  selected: TrialKnowledgeSource | null;
  onSelect: (source: TrialKnowledgeSource) => void;
  questions: TrialQuestion[];
}) {
  return (
    <section>
      <header className="text-center">
        <p className="text-sm font-semibold text-brand-700">Step 1 of 3</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          Teach Nudge about your clinic
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">
          Choose one starting source. You can edit every approved fact later.
        </p>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {sourceCards.map(({ key, label, hint, icon: Icon }) => (
          <button
            key={key}
            type="button"
            data-source-card={key}
            aria-pressed={selected === key}
            onClick={() => onSelect(key)}
            className={`min-h-28 rounded-xl border p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/60 ${selected === key ? "border-brand-500 bg-brand-50" : "border-neutral-200 bg-white hover:border-neutral-300"}`}
          >
            <Icon className={`h-5 w-5 ${selected === key ? "text-brand-700" : "text-neutral-400"}`} aria-hidden />
            <span className="mt-4 block text-sm font-semibold text-neutral-900">{label}</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-500">{hint}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <Card className="mt-5 p-5">
          <SourceForm source={selected} questions={questions} />
        </Card>
      ) : null}
    </section>
  );
}

function SourceForm({
  source,
  questions,
}: {
  source: TrialKnowledgeSource;
  questions: TrialQuestion[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    setMessage("");
    startTransition(async () => {
      const result = await work();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (source === "website") run(() => importWebsiteAction(value));
    if (source === "gbp") run(() => importGbpAction(value));
    if (source === "interview") {
      run(() =>
        submitQuestionnaireAction(
          questions.map((question) => ({
            id: question.id,
            answer: answers[question.id] ?? "",
          })),
        ),
      );
    }
  }

  if (source === "file") {
    return (
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Upload one useful file</h2>
        <p className="mt-1 text-xs leading-5 text-neutral-500">PDF, JPG, PNG, or WebP. Maximum 5 MB.</p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const data = new FormData();
            data.set("file", file);
            run(() => importFileAction(data));
          }}
        />
        <Button className="mt-4" disabled={pending} onClick={() => fileRef.current?.click()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
          {pending ? "Reading file…" : "Choose file"}
        </Button>
        <Status message={message} />
      </div>
    );
  }

  if (source === "interview") {
    return (
      <form onSubmit={submit}>
        <h2 className="text-sm font-semibold text-neutral-900">Five clinic essentials</h2>
        <div className="mt-4 space-y-4">
          {questions.map((question) => (
            <label key={question.id} className="block text-sm font-medium text-neutral-800">
              {question.prompt}
              <textarea
                value={answers[question.id] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                placeholder={question.placeholder}
                rows={3}
                required
                className="mt-1.5 w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400/50"
              />
            </label>
          ))}
        </div>
        <Button type="submit" className="mt-5" loading={pending}>Save answers and continue</Button>
        <Status message={message} />
      </form>
    );
  }

  const website = source === "website";
  return (
    <form onSubmit={submit}>
      <label className="text-sm font-semibold text-neutral-900" htmlFor={`trial-${source}`}>
        {website ? "Clinic website" : "Clinic name and city"}
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id={`trial-${source}`}
          type={website ? "url" : "text"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={website ? "https://yourclinic.com" : "Aster Clinic, Bengaluru"}
          required
          className="flex-1"
        />
        <Button type="submit" loading={pending}>{website ? "Read website" : "Find profile"}</Button>
      </div>
      <Status message={message} />
    </form>
  );
}

function ReviewStep({ drafts }: { drafts: TrialDraftFact[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(work: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      const result = await work();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section>
      <header className="text-center">
        <p className="text-sm font-semibold text-brand-700">Step 2 of 3</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">Review what Nudge found</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">Only approved facts can ground trial replies.</p>
      </header>
      <div className="mt-7 space-y-2">
        {drafts.length ? drafts.map((draft) => (
          <Card key={draft.id} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{draft.category.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm leading-6 text-neutral-800">{draft.fact}</p>
              {draft.condition ? <p className="mt-1 text-xs text-neutral-500">Only when: {draft.condition}</p> : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" aria-label="Approve fact" disabled={pending} onClick={() => run(() => approveDraftAction(draft.id))}><Check className="h-4 w-4" aria-hidden /></Button>
              <Button size="sm" variant="ghost" aria-label="Discard fact" disabled={pending} onClick={() => run(() => discardDraftAction(draft.id))}><X className="h-4 w-4" aria-hidden /></Button>
            </div>
          </Card>
        )) : (
          <Card className="p-5 text-sm text-neutral-600">
            <p>No draft facts remain. Add one clinic fact to continue.</p>
            <Link
              href="/agent"
              className={`${buttonVariants({ size: "sm" })} mt-4`}
            >
              Add a fact manually
            </Link>
          </Card>
        )}
      </div>
      {drafts.length ? (
        <Button className="mt-5 w-full sm:w-auto" loading={pending} onClick={() => run(approveAllDraftsAction)}>
          Approve all and continue
        </Button>
      ) : null}
      <Status message={message} />
    </section>
  );
}

function ReadyStep({ factCount }: { factCount: number }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-700"><Check className="h-7 w-7" aria-hidden /></span>
      <p className="mt-5 text-sm font-semibold text-brand-700">Step 3 of 3</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">Ready to test</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">Nudge has {factCount} approved fact{factCount === 1 ? "" : "s"} to ground your first replies.</p>
      <Button
        size="lg"
        className="mt-6"
        loading={pending}
        onClick={() => startTransition(async () => {
          const result = await completeTrialSetupAction();
          if (result?.ok === false) setMessage(result.message);
        })}
      >
        Open my trial
      </Button>
      <Status message={message} />
    </section>
  );
}

function Status({ message }: { message: string }) {
  return <p aria-live="polite" className="mt-3 min-h-5 text-sm text-neutral-600">{message}</p>;
}
