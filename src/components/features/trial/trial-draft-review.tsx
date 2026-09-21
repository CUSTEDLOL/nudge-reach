"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveAllDraftsAction,
  approveDraftAction,
  discardAllDraftsAction,
  discardDraftAction,
  type ActionResult,
} from "@/app/(app)/agent/training-actions";

export interface TrialDraftFact {
  id: string;
  category: string;
  fact: string;
  condition: string | null;
}

export function TrialDraftReview({
  drafts,
  canEdit,
}: {
  drafts: TrialDraftFact[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="border-t border-neutral-200 py-7" aria-labelledby="trial-drafts-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="trial-drafts-heading" className="text-base font-semibold text-neutral-900">
            Drafts to review
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Imported facts stay out of customer replies until you approve them.
          </p>
        </div>
        {canEdit && drafts.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => run(discardAllDraftsAction)}
            >
              Discard all
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => run(approveAllDraftsAction)}
            >
              Approve all
            </Button>
          </div>
        )}
      </div>

      {drafts.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No drafts waiting for review.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100 border-y border-neutral-100">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-neutral-800">{draft.fact}</p>
                {draft.condition && (
                  <p className="mt-1 text-xs text-neutral-500">Only when: {draft.condition}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => discardDraftAction(draft.id))}
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => approveDraftAction(draft.id))}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className="mt-3 text-sm text-neutral-600" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
