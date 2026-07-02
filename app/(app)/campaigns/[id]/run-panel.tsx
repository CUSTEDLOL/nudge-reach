"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  runCampaignAction,
  type ActionResult,
} from "../actions";

export interface AudienceOption {
  id: string;
  name: string;
  optedInCount: number;
}

export function RunPanel({
  campaignId,
  audiences,
  ratePaise,
  simulation,
}: {
  campaignId: string;
  audiences: AudienceOption[];
  ratePaise: number;
  simulation: boolean;
}) {
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? "");
  const [result, run, running] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      runCampaignAction(formData),
    null
  );

  const selected = audiences.find((a) => a.id === audienceId);
  const estimate = selected ? selected.optedInCount * ratePaise : 0;

  if (audiences.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
        You need an audience first —{" "}
        <Link href="/contacts" className="text-emerald-700 underline">
          create one from your customers
        </Link>
        .
      </div>
    );
  }

  return (
    <form
      action={run}
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium text-neutral-700">
          Send to
          <select
            name="audienceId"
            value={audienceId}
            onChange={(e) => setAudienceId(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.optedInCount} opted in)
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-neutral-600">
          <p className="font-medium text-neutral-700">Estimated cost</p>
          <p className="mt-1">
            {selected?.optedInCount ?? 0} × ₹{(ratePaise / 100).toFixed(2)} ={" "}
            <span className="font-semibold text-neutral-900">
              ₹{(estimate / 100).toFixed(2)}
            </span>{" "}
            <span className="text-xs text-neutral-400">(estimate)</span>
          </p>
        </div>

        <button
          disabled={running || !selected?.optedInCount}
          className="ml-auto rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {running
            ? "Starting…"
            : simulation
              ? "🚀 Run campaign (simulated)"
              : "🚀 Run campaign"}
        </button>
      </div>
      {simulation && (
        <p className="mt-3 text-xs text-neutral-400">
          Simulation mode: no real messages leave the building — delivery is
          mocked so you can see the full journey.
        </p>
      )}
      {result && !result.ok && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.message}
        </p>
      )}
    </form>
  );
}
