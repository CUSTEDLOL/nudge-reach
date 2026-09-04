"use client";

import { useState, useTransition } from "react";
import { setPlanAction } from "./actions";

/** Plan changer with an explicit confirm step — the panel's one mutation. */
export function SetPlanForm({
  orgId,
  currentPlan,
  planIds,
}: {
  orgId: string;
  currentPlan: string;
  planIds: string[];
}) {
  const [plan, setPlan] = useState(currentPlan);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (plan === currentPlan) return;
    if (!window.confirm(`Change this org's plan from "${currentPlan}" to "${plan}"?`)) {
      return;
    }
    const fd = new FormData();
    fd.set("orgId", orgId);
    fd.set("plan", plan);
    startTransition(async () => {
      const res = await setPlanAction(fd);
      setMessage(res.message);
    });
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Plan"
        >
          {planIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || plan === currentPlan}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Change plan"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-neutral-600">{message}</p>}
      <p className="mt-2 text-xs text-neutral-400">
        Audited: every change is written to the org&apos;s audit log with your email.
      </p>
    </div>
  );
}
