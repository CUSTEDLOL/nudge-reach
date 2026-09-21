import Link from "next/link";
import { AiOffNotice } from "@/components/features/front-desk/ai-off-notice";
import { BookDemoButton } from "@/components/marketing/book-demo";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { isSimulated } from "@/modules/orgs/mode";
import { trialTestIdentity } from "@/modules/trial/test-inbox";
import { getTrialTestConversation } from "@/modules/trial/test-inbox-query";
import type { TrialWorkspace } from "@/modules/trial/workspace";
import { TryYourAi } from "./try-your-ai";

interface TrialInboxOrg {
  id: string;
  dialCode: string;
  simulated: boolean;
}

export async function TrialInbox({
  org,
  workspace,
  upgrade,
}: {
  org: TrialInboxOrg;
  workspace: TrialWorkspace;
  upgrade: string | null;
}) {
  const trialData = workspace.knowledgeReady
    ? await Promise.all([
        prisma.agentProfile.findUnique({
          where: { orgId: org.id },
          select: { enabled: true },
        }),
        getTrialTestConversation(org.id),
      ])
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Inbox
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600">
          Test a customer question in this private workspace. Nothing is sent
          to a real phone.
        </p>
      </header>

      {upgrade ? (
        <div
          role="status"
          className="border-l-2 border-brand-500 bg-brand-50/70 px-4 py-3 text-sm leading-6 text-brand-950"
        >
          That feature is available on a paid plan. Keep testing here or train
          Nudge with more business information.
        </div>
      ) : null}

      {!workspace.knowledgeReady ? (
        <section className="border-y border-neutral-200 py-10 sm:py-12">
          <h2 className="text-lg font-semibold text-neutral-950">
            Add business information before you test
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
            Nudge answers only from facts you approve, so it needs something
            reliable to work from first.
          </p>
          <Link
            href="/agent"
            className={buttonVariants({ className: "mt-5" })}
          >
            Train AI
          </Link>
        </section>
      ) : (
        <>
          {trialData?.[0] && !trialData[0].enabled ? (
            <AiOffNotice canEdit />
          ) : null}
          <TryYourAi
            simulation={isSimulated(org)}
            dialCode={org.dialCode}
            connectedName={null}
            trial={workspace}
            testIdentity={trialTestIdentity()}
            initialMessages={trialData?.[1].messages ?? []}
          />
        </>
      )}

      <p className="border-t border-neutral-200 pt-5 text-sm text-neutral-600">
        Connect your real WhatsApp —{" "}
        <BookDemoButton
          surface="free-trial"
          className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
        >
          Book a free demo
        </BookDemoButton>{" "}
        <span aria-hidden>·</span>{" "}
        <Link
          href="/pricing"
          className="font-semibold text-neutral-800 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-950"
        >
          View plans
        </Link>
      </p>
    </div>
  );
}
