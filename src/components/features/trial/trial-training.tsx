import Link from "next/link";
import { Library, type LibraryFact } from "@/app/(app)/agent/library";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { TrialWorkspace } from "@/modules/trial/workspace";
import {
  TrialDraftReview,
  type TrialDraftFact,
} from "./trial-draft-review";
import { TrialKnowledgeSources } from "./trial-knowledge-sources";

export function TrialTraining({
  workspace,
  facts,
  drafts,
  canEdit,
}: {
  workspace: TrialWorkspace;
  facts: LibraryFact[];
  drafts: TrialDraftFact[];
  canEdit: boolean;
}) {
  // Mirrors the paid page: once it has been taught, lead with what it knows.
  const taught = workspace.approvedFactCount > 0;

  const sources = (
    <div className="flex flex-col gap-8">
      <TrialKnowledgeSources
        canEdit={canEdit}
        webImportsUsed={workspace.webImportsUsed}
        webImportLimit={workspace.webImportLimit}
        fileImportsUsed={workspace.fileImportsUsed}
        fileImportLimit={workspace.fileImportLimit}
      />
      <TrialDraftReview drafts={drafts} canEdit={canEdit} />
    </div>
  );

  const library = (
    /* the guided tour's "train" step spotlights this — see modules/trial/tour */
    <div id="library" data-tour="training-source">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="trial-approved-heading" className="text-sm font-semibold text-neutral-900">
          {taught
            ? `Your AI knows ${workspace.approvedFactCount} fact${workspace.approvedFactCount === 1 ? "" : "s"}`
            : "Approved facts"}
        </h2>
        <span className="text-xs tabular-nums text-neutral-500">
          Facts {workspace.factCount}/{workspace.factLimit}
        </span>
      </div>
      <Library
        facts={facts}
        canEdit={canEdit}
        showStructureButton={false}
        factCount={workspace.factCount}
        factLimit={workspace.factLimit}
        factPlaceholder="e.g. Standard setup costs $120"
      />
    </div>
  );

  return (
    <section>
      <PageHeader
        title="Train AI"
        description="Add the business information Nudge can use when it replies. Review imported facts before they go live."
        actions={
          workspace.approvedFactCount > 0 ? (
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Test in Inbox
            </Link>
          ) : undefined
        }
      />

      {/* Same rhythm as the paid Training page: full width, one flat stack
          of labelled blocks, and the library leading once it knows anything.
          The trial's own limits stay — they are what the trial is. */}
      <div className="flex flex-col gap-8">
        {taught ? (
          <>
            {library}
            {sources}
          </>
        ) : (
          <>
            {sources}
            {library}
          </>
        )}
      </div>
    </section>
  );
}
