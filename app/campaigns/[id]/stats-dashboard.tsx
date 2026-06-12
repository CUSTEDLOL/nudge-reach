"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface CampaignStatsView {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  actualCostMinor: number;
}

function StatCard({
  label,
  value,
  total,
  accent,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>{value}</p>
      <p className="text-xs text-neutral-400">{pct}%</p>
    </div>
  );
}

export function StatsDashboard({
  campaignId,
  status,
  stats,
  estimatedCostMinor,
  simulation,
}: {
  campaignId: string;
  status: string;
  stats: CampaignStatsView;
  estimatedCostMinor: number;
  simulation: boolean;
}) {
  const router = useRouter();
  const live = status === "SENDING" || stats.sent > stats.read + stats.failed;

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [live, router]);

  const doneCount = stats.total - stats.queued;
  const progressPct =
    stats.total > 0 ? Math.round((doneCount / stats.total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">
          {status === "SENDING" ? "📤 Sending…" : "📊 Results"}
          {simulation && (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              simulated
            </span>
          )}
        </h2>
        <p className="text-sm text-neutral-500">
          {doneCount}/{stats.total} processed
        </p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Sent" value={stats.sent} total={stats.total} accent="text-neutral-900" />
        <StatCard label="Delivered" value={stats.delivered} total={stats.total} accent="text-emerald-600" />
        <StatCard label="Read" value={stats.read} total={stats.total} accent="text-blue-600" />
        <StatCard label="Clicked" value={stats.clicked} total={stats.total} accent="text-violet-600" />
        <StatCard label="Failed" value={stats.failed} total={stats.total} accent="text-red-500" />
      </div>

      <div className="mt-4 flex flex-wrap gap-6 rounded-xl bg-neutral-50 p-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Estimated cost
          </p>
          <p className="mt-0.5 font-semibold text-neutral-900">
            ₹{(estimatedCostMinor / 100).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {simulation ? "Cost so far (simulated)" : "Actual cost so far"}
          </p>
          <p className="mt-0.5 font-semibold text-neutral-900">
            ₹{(stats.actualCostMinor / 100).toFixed(2)}
          </p>
          <p className="text-xs text-neutral-400">
            billed per delivered message
          </p>
        </div>
      </div>
    </section>
  );
}
