import Link from "next/link";
import { Library, type LibraryFact } from "@/app/(app)/agent/library";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { TrialWorkspace } from "@/modules/trial/workspace";
import {
  TrialDraftReview,
  type TrialDraftFact,
} from "./trial-draft-review";

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
          // "Try it in chat", not "Test in Inbox": one name per action, in the
          // house's sentence case. It is the same job the paid page's header
          // button does from the same slot, and the same words the auto-reply
          // toast and the questionnaire's CTA already use — and it names the
          // action rather than a surface a trial does not have (this goes to
          // /dashboard, which renders the trial's own inbox).
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Try it in chat
          </Link>
        ) : undefined
      }
    />
  );
}

/**
 * The trial's "What it knows": the same fact library the paid app shows, with
 * the trial's 50-fact ceiling around it, and the queue of imported facts
 * waiting to be reviewed.
 *
 * Where those facts come from — `TrialKnowledgeSources`, the website / Google
 * listing / PDF box — used to render here too. It now renders from the page's
 * rail, where the paid page puts `ImportPanel`, so both kinds of workspace put
 * the import box in the same place. The draft review stays: it is a review
 * queue and wants the width of the body column.
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

  const review = <TrialDraftReview drafts={drafts} canEdit={canEdit} />;

  const library = (
    /* the guided tour's "train" step spotlights this — see modules/trial/tour.
       A labelled <section>, not a bare <div>: `trial-approved-heading` was a
       dead id that nothing pointed at, while every sibling block on this page
       — the draft review, House rules, "What it knows" — is a section named by
       its own heading. Kept as `#library`, which is where the questionnaire's
       "back to Training" link lands. */
    <section
      id="library"
      data-tour="training-source"
      aria-labelledby="trial-approved-heading"
    >
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
    </section>
  );

  return (
    <div className="flex flex-col gap-8">
      {taught ? (
        <>
          {library}
          {review}
        </>
      ) : (
        <>
          {review}
          {library}
        </>
      )}
    </div>
  );
}
