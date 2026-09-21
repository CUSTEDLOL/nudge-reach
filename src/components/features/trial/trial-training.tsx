import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Library, type LibraryFact } from "@/app/(app)/agent/library";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { TrialKnowledgeSource } from "@/modules/trial/workspace";

const SOURCE_LABELS: Record<TrialKnowledgeSource, string> = {
  website: "Website",
  gbp: "Google Business Profile",
  file: "Uploaded file",
  interview: "5-question interview",
};

export function TrialTraining({
  facts,
  source,
  canEdit,
  setupComplete,
}: {
  facts: LibraryFact[];
  source: TrialKnowledgeSource | null;
  canEdit: boolean;
  setupComplete: boolean;
}) {
  return (
    <section>
      <PageHeader
        title="Train AI"
        description="Review and edit the clinic facts that ground every trial reply."
        actions={
          <Link
            href={setupComplete ? "/inbox/try" : "/trial/setup"}
            className={buttonVariants({ size: "sm" })}
          >
            {setupComplete ? "Test your AI" : "Continue setup"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />
      <div data-tour="training-source" className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <CheckCircle2 className="h-4 w-4 text-brand-700" aria-hidden />
        <span className="font-medium">Setup source</span>
        <Badge tone="success">{source ? SOURCE_LABELS[source] : "Manual facts"}</Badge>
        <span className="text-brand-900/65">You can edit these facts, but the trial does not run a second import.</span>
      </div>
      <Library facts={facts} canEdit={canEdit} showStructureButton={false} />
    </section>
  );
}
