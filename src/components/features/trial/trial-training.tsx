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
 * below it the trial renders exactly the sections the paid app renders.
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
  return (
    <div>
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <p className="text-sm text-neutral-600">
          Facts {workspace.factCount}/{workspace.factLimit}
        </p>
        <p className="text-xs text-neutral-500">Approved and draft facts combined</p>
      </div>

      <TrialKnowledgeSources
        canEdit={canEdit}
        webImportsUsed={workspace.webImportsUsed}
        webImportLimit={workspace.webImportLimit}
        fileImportsUsed={workspace.fileImportsUsed}
        fileImportLimit={workspace.fileImportLimit}
      />

      <TrialDraftReview drafts={drafts} canEdit={canEdit} />

      <section className="border-t border-neutral-200 py-7" aria-labelledby="trial-approved-heading">
        <div className="mb-4">
          <h2 id="trial-approved-heading" className="text-base font-semibold text-neutral-900">
            Approved facts
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Add a fact manually or edit what Nudge is allowed to say about your business.
          </p>
        </div>
        <Library
          facts={facts}
          canEdit={canEdit}
          showStructureButton={false}
          factCount={workspace.factCount}
          factLimit={workspace.factLimit}
          factPlaceholder="e.g. Standard setup costs $120"
        />
      </section>
    </div>
  );
}
