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

/**
 * The trial's own title for the shared Training page. Chrome, not substance:
 * below it the trial renders the same sections the paid app renders, through
 * the same layout — which is why the title is a separate export rather than
 * part of the body. `/agent` owns the page: its header slot, its two-column
 * grid, its rail. This is only what goes where the paid page says "Training".
 */
export function TrialTrainingHeader({
  workspace,
}: {
  workspace: TrialWorkspace;
}) {
  return (
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
  );
}

/**
 * The trial's "What it knows": the same fact library the paid app shows, with
 * the trial's import allowances and its 50-fact ceiling around it.
 *
 * The page supplies the "What it knows" heading above this, so the heading
 * here is one level down from it — the same level as the paid path's own
 * sub-headings, which are this component's siblings on that page.
 */
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
        <h3
          id="trial-approved-heading"
          className="text-sm font-semibold text-neutral-900"
        >
          {taught
            ? `Your AI knows ${workspace.approvedFactCount} fact${workspace.approvedFactCount === 1 ? "" : "s"}`
            : "Approved facts"}
        </h3>
        {/* Approved and draft facts combined — what the 50-fact ceiling counts. */}
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
  );
}
