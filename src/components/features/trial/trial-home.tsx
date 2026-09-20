import Link from "next/link";
import { ArrowRight, BookOpenCheck, MessageCircleMore } from "lucide-react";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildTrialChecklist } from "@/modules/trial/checklist";
import type { TrialWorkspace } from "@/modules/trial/workspace";
import { TrialChecklist } from "./trial-checklist";
import { trialStatusText } from "./trial-status-strip";
import { RestartTrialTourButton } from "./trial-tour";

export function TrialHome({
  businessName,
  workspace,
}: {
  businessName: string;
  workspace: TrialWorkspace;
}) {
  const checklist = buildTrialChecklist(workspace);
  const complete = checklist.filter((item) => item.done).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge tone="success">Guided free trial</Badge>
          <h1 data-tour="trial-home" className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            Welcome to {businessName}{"'s AI Front Desk"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Follow the short checklist, test a real patient question, then preview what Nudge can run when you go live.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Link href="/inbox/try" className={buttonVariants({ size: "lg" })}>
            Test your AI <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <RestartTrialTourButton />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Your trial checklist</p>
              <p className="mt-1 text-xs text-neutral-500">{complete} of {checklist.length} complete</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-brand-700">
              {Math.round((complete / checklist.length) * 100)}%
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${(complete / checklist.length) * 100}%` }} />
          </div>
          <div className="mt-3">
            <TrialChecklist items={checklist} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="border-brand-100 bg-brand-50 p-5">
            <p className="text-sm font-semibold text-brand-900">Trial progress</p>
            <p className="mt-2 text-sm leading-6 text-brand-900/70">
              {trialStatusText(workspace)}
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <BookOpenCheck className="h-5 w-5 text-brand-700" aria-hidden />
              <p className="mt-5 text-2xl font-semibold tabular-nums text-neutral-950">{workspace.knowledgeCount}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">Approved clinic facts</p>
            </Card>
            <Card className="p-4">
              <MessageCircleMore className="h-5 w-5 text-brand-700" aria-hidden />
              <p className="mt-5 text-2xl font-semibold tabular-nums text-neutral-950">{workspace.firstReplyAt ? 1 : 0}</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">Test conversations completed</p>
            </Card>
          </div>
        </div>
      </div>

      <section id="trial-conversion" data-tour="trial-conversion" className="scroll-mt-28 rounded-2xl border border-neutral-200 bg-neutral-950 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
        <div>
          <p className="text-sm font-semibold text-brand-300">Ready for the real front desk?</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Connect WhatsApp and your clinic systems with us.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">We will map the setup, integrations, and paid tier that fit your clinic.</p>
        </div>
        <div className="mt-5 flex shrink-0 flex-col gap-3 sm:mt-0 sm:items-start">
          <BookDemoButton surface="trial_workspace" variant="primary" size="md">Book a free demo</BookDemoButton>
          <Link href="/pricing" className="text-sm font-semibold text-white/75 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300">See paid plans</Link>
        </div>
      </section>
    </div>
  );
}
